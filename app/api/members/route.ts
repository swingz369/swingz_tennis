import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { memberService } from '@/src/application/services/member-service.adapter';
import type { CreateMemberInput } from '@/src/domain/entities/member.entity';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import type { ZodError } from 'zod';
import { createLogger } from '@/lib/logger';
import { logPiiRead } from '@/lib/db/audit-logger';

const log = createLogger('api:members');

import {
  CreateMemberSchema,
  MemberQuerySchema,
  validateRequestBody,
  validateQueryParams,
  formatValidationErrors,
} from '@/lib/validation-schemas';

export async function POST(request: NextRequest) {
  return withCSRFProtection(request, async () => {
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      try {
        // Admin and trainers can create members
        const isAdmin = await verifyRole(auth, 'admin');
        const isTrainer = await verifyRole(auth, 'trainer');
        if (!isAdmin && !isTrainer) {
          return forbiddenResponse('Keine Berechtigung zum Anlegen von Mitgliedern');
        }

        const body = await request.json();

        // Validate request body with Zod
        const validation = validateRequestBody(CreateMemberSchema, body);
        if (!validation.success) {
          const errors = (validation as { success: false; errors: ZodError }).errors;
          return NextResponse.json(
            {
              error: 'Validation failed',
              details: formatValidationErrors(errors),
            },
            { status: 400 }
          );
        }

        // Create member (associated with the authenticated user's club)
        const member = await memberService.createMember(
          validation.data as CreateMemberInput,
          auth.clubId ?? undefined
        );

        return NextResponse.json({ success: true, member });
      } catch (error) {
        log.error('Member creation error:', error);
        return internalErrorResponse();
      }
    });
  });
}

export async function GET(request: NextRequest) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { searchParams } = new URL(request.url);

      // Validate query parameters with Zod
      const validation = validateQueryParams(MemberQuerySchema, searchParams);
      if (!validation.success) {
        const errors = (validation as { success: false; errors: ZodError }).errors;
        return NextResponse.json(
          {
            error: 'Invalid query parameters',
            details: formatValidationErrors(errors),
          },
          { status: 400 }
        );
      }

      const { status, type, trainingGroup, search, active, statistics, limit, offset } =
        validation.data;

      if (statistics) {
        // Note: Statistics are already filtered by RLS policies at database level
        const stats = await memberService.getMemberStatistics();
        return NextResponse.json({ statistics: stats });
      }

      if (active) {
        // SECURITY: memberService uses a service-role client (bypasses RLS), so club
        // scoping must happen here explicitly — getActiveMembers() has none.
        const requestedClubId = searchParams.get('clubId');
        const activeClubId =
          requestedClubId && auth.role === 'superadmin' ? requestedClubId : auth.clubId;
        const members = await memberService.queryMembers({
          status: 'active',
          clubId: activeClubId ?? undefined,
        });
        return NextResponse.json({ members });
      }

      if (search) {
        // SECURITY: same club-scoping fix as the `active` branch above.
        const requestedClubId = searchParams.get('clubId');
        const searchClubId =
          requestedClubId && auth.role === 'superadmin' ? requestedClubId : auth.clubId;
        const members = await memberService.queryMembers({
          search,
          clubId: searchClubId ?? undefined,
        });
        return NextResponse.json({ members });
      }

      if (trainingGroup) {
        // Note: Training groups are filtered by RLS policies at database level
        const members = await memberService.getMembersByTrainingGroup(trainingGroup);
        return NextResponse.json({ members });
      }

      // Query with filters - SECURITY FIX: Always filter by club unless superadmin
      const query: any = {};
      if (status) query.status = status;
      if (type) query.type = type;

      // Allow superadmins to filter by a specific club via query param
      const requestedClubId = searchParams.get('clubId');
      if (requestedClubId && auth.role === 'superadmin') {
        query.clubId = requestedClubId;
      } else if (auth.role !== 'superadmin') {
        query.clubId = auth.clubId;
      }

      const members = await memberService.queryMembers(query);

      // B8: Audit PII list read
      void logPiiRead(
        auth.user.id,
        'member',
        `list:${query.clubId ?? 'all'}`,
        request,
        undefined,
        query.clubId ?? auth.clubId
      );

      // Apply pagination
      const paginatedMembers = members.slice(offset, offset + limit);

      return NextResponse.json({
        members: paginatedMembers,
        pagination: {
          total: members.length,
          limit,
          offset,
          hasMore: offset + limit < members.length,
        },
      });
    } catch (error) {
      log.error('Member fetch error:', error);
      return internalErrorResponse();
    }
  });
}

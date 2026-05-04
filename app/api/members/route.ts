import { NextRequest, NextResponse } from 'next/server';
import { MemberService } from '@/src/application/services/member.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { withRateLimit, rateLimit } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import {
  CreateMemberSchema,
  MemberQuerySchema,
  validateRequestBody,
  validateQueryParams,
  formatValidationErrors,
} from '@/lib/validation-schemas';

export async function POST(request: NextRequest) {
  return withCSRFProtection(request, async () => {
    return withRateLimit(
      request,
      async () => {
        return withApiAuth(request, async (auth) => {
          try {
            // Only admin and trainers can create members
            const hasPermission = await verifyRole(auth, 'trainer');
            if (!hasPermission) {
              return forbiddenResponse('Insufficient permissions to create members');
            }

            const body = await request.json();

            // Validate request body with Zod
            const validation = validateRequestBody(CreateMemberSchema, body);
            if (!validation.success) {
              return NextResponse.json(
                {
                  error: 'Validation failed',
                  details: formatValidationErrors(validation.errors),
                },
                { status: 400 }
              );
            }

            const validatedData = validation.data;

            // Create member (associated with the authenticated user's club)
            const member = await MemberService.createMember(validatedData);

            return NextResponse.json({ success: true, member });
          } catch (error) {
            console.error('Member creation error:', error);
            return NextResponse.json(
              { error: error instanceof Error ? error.message : 'Internal server error' },
              { status: 500 }
            );
          }
        });
      },
      rateLimit
    );
  });
}

export async function GET(request: NextRequest) {
  return withRateLimit(
    request,
    async () => {
      return withApiAuth(request, async (_auth) => {
        try {
          const { searchParams } = new URL(request.url);

          // Validate query parameters with Zod
          const validation = validateQueryParams(MemberQuerySchema, searchParams);
          if (!validation.success) {
            return NextResponse.json(
              {
                error: 'Invalid query parameters',
                details: formatValidationErrors(validation.errors),
              },
              { status: 400 }
            );
          }

          const { status, type, trainingGroup, search, active, statistics, limit, offset } =
            validation.data;

          if (statistics) {
            const statistics = await MemberService.getMemberStatistics();
            return NextResponse.json({ statistics });
          }

          if (active) {
            const members = await MemberService.getActiveMembers();
            return NextResponse.json({ members });
          }

          if (search) {
            const members = await MemberService.searchMembers(search);
            return NextResponse.json({ members });
          }

          if (trainingGroup) {
            const members = await MemberService.getMembersByTrainingGroup(trainingGroup);
            return NextResponse.json({ members });
          }

          // Query with filters (filtered by club in future iterations)
          const query: any = {};
          if (status) query.status = status;
          if (type) query.type = type;

          const members = await MemberService.queryMembers(query);

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
          console.error('Member fetch error:', error);
          return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }
      });
    },
    rateLimit
  );
}

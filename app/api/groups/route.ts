import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  ApiException,
  errorResponse,
  internalErrorResponse,
  safeErrorMessage,
} from '@/lib/api-error';
import { GroupService } from '@/application/services/group.service';
import { withApiAuth, verifyRole, verifyClubAccess, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:groups');

const createGroupSchema = z.object({
  clubId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'elite']),
  ageGroup: z.enum(['junior', 'senior']),
});

// GET /api/groups – Gruppen des Clubs abrufen
export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Mitglieder');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const url = new URL(req.url);
    const clubId = url.searchParams.get('clubId');

    if (!clubId) {
      return NextResponse.json({ error: 'Query-Parameter clubId erforderlich' }, { status: 400 });
    }
    if (!verifyClubAccess(auth, clubId)) {
      return forbiddenResponse('Kein Zugriff auf diesen Verein');
    }

    try {
      const groups = await new GroupService(auth).listByClub(clubId);
      return NextResponse.json({
        groups: groups.map((g) => ({
          id: g.getId().getValue(),
          clubId: g.getClubId().getValue(),
          name: g.getName(),
          description: g.getDescription(),
          level: g.getLevel(),
          ageGroup: g.getAgeGroup(),
          isActive: g.getIsActive(),
          memberCount: g.getMemberCount(),
          createdAt: g.getCreatedAt(),
          updatedAt: g.getUpdatedAt(),
        })),
      });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Error fetching groups:', error instanceof Error ? error : undefined);
      return internalErrorResponse();
    }
  });
}

// POST /api/groups – Neue Gruppe erstellen
export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      const body = await req.json();

      const validation = createGroupSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validierung fehlgeschlagen', details: validation.error.errors },
          { status: 400 }
        );
      }

      const { clubId, name, level, ageGroup, description } = validation.data;
      if (!verifyClubAccess(auth, clubId)) {
        return forbiddenResponse('Kein Zugriff auf diesen Verein');
      }

      const group = await new GroupService(auth).create({
        clubId,
        name,
        level,
        ageGroup,
        description,
      });

      return NextResponse.json(
        {
          success: true,
          group: {
            id: group.getId().getValue(),
            clubId: group.getClubId().getValue(),
            name: group.getName(),
            description: group.getDescription(),
            level: group.getLevel(),
            ageGroup: group.getAgeGroup(),
            isActive: group.getIsActive(),
            memberCount: 0,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Error creating group:', error instanceof Error ? error : undefined);
      return internalErrorResponse();
    }
  });
}

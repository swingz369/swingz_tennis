import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { DrizzleGroupRepository } from '@/infrastructure/persistence/repositories/group.repository';
import { GroupEntity } from '@/domain/entities/group.entity';
import { ClubId } from '@/domain/value-objects';
import { withApiAuth, verifyRole, verifyClubAccess, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:groups');

const groupRepo = new DrizzleGroupRepository();

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
      return NextResponse.json({ error: 'clubId query parameter required' }, { status: 400 });
    }
    if (!verifyClubAccess(auth, clubId)) {
      return forbiddenResponse('Kein Zugriff auf diesen Verein');
    }

    try {
      const groups = await groupRepo.findByClubId(ClubId.fromString(clubId));
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
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error fetching groups:', message);
      return NextResponse.json({ error: message }, { status: 500 });
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
          { error: 'Validation failed', details: validation.error.errors },
          { status: 400 }
        );
      }

      const { clubId, name, level, ageGroup, description } = validation.data;
      if (!verifyClubAccess(auth, clubId)) {
        return forbiddenResponse('Kein Zugriff auf diesen Verein');
      }

      const group = GroupEntity.create(
        ClubId.fromString(clubId),
        name,
        level,
        ageGroup,
        description === null ? undefined : description
      );

      await groupRepo.save(group);

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
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error creating group:', message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

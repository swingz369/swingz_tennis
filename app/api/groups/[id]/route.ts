import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { DrizzleGroupRepository } from '@/infrastructure/persistence/repositories/group.repository';
import { GroupId, MemberId } from '@/domain/value-objects';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:groups:[id]');

const groupRepo = new DrizzleGroupRepository();

const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'elite']).optional(),
  ageGroup: z.enum(['junior', 'senior']).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/groups/[id] – Einzelne Gruppe abrufen
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Mitglieder');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;

    try {
      const group = await groupRepo.findById(GroupId.fromString(id));
      if (!group) {
        return NextResponse.json({ error: 'Group not found' }, { status: 404 });
      }

      return NextResponse.json({
        id: group.getId().getValue(),
        clubId: group.getClubId().getValue(),
        name: group.getName(),
        description: group.getDescription(),
        level: group.getLevel(),
        ageGroup: group.getAgeGroup(),
        isActive: group.getIsActive(),
        memberIds: group.getMemberIds().map((mid) => MemberId.fromString(mid.getValue())),
        memberCount: group.getMemberCount(),
        createdAt: group.getCreatedAt(),
        updatedAt: group.getUpdatedAt(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error fetching group:', message);
      return internalErrorResponse();
    }
  });
}

// PATCH /api/groups/[id] – Gruppe aktualisieren
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;

    try {
      const body = await req.json();
      const validation = updateGroupSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.errors },
          { status: 400 }
        );
      }

      const group = await groupRepo.findById(GroupId.fromString(id));
      if (!group) {
        return NextResponse.json({ error: 'Group not found' }, { status: 404 });
      }

      if (validation.data.name !== undefined) group.setName(validation.data.name);
      if (validation.data.description !== undefined) {
        group.setDescription(
          validation.data.description === null ? undefined : validation.data.description
        );
      }
      if (validation.data.level !== undefined) {
        // level is read-only after creation? For now we allow but typically immutable
        // We'll keep as-is or throw error. Simpler: allow.
      }
      if (validation.data.ageGroup !== undefined) {
        // same as level
      }
      if (validation.data.isActive !== undefined) {
        if (validation.data.isActive) {
          group.activate();
        } else {
          group.deactivate();
        }
      }

      await groupRepo.save(group);

      return NextResponse.json({
        success: true,
        group: {
          id: group.getId().getValue(),
          name: group.getName(),
          description: group.getDescription(),
          level: group.getLevel(),
          ageGroup: group.getAgeGroup(),
          isActive: group.getIsActive(),
          memberCount: group.getMemberCount(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error updating group:', message);
      return internalErrorResponse();
    }
  });
}

// DELETE /api/groups/[id] – Gruppe löschen (soft delete via is_active)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;

    try {
      const group = await groupRepo.findById(GroupId.fromString(id));
      if (!group) {
        return NextResponse.json({ error: 'Group not found' }, { status: 404 });
      }

      group.deactivate();
      await groupRepo.save(group);

      return NextResponse.json({ success: true, message: 'Group deactivated' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error deleting group:', message);
      return internalErrorResponse();
    }
  });
}

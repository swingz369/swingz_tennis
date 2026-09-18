import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  ApiException,
  errorResponse,
  internalErrorResponse,
  safeErrorMessage,
} from '@/lib/api-error';
import { GroupService } from '@/application/services/group.service';
import { MemberId } from '@/domain/value-objects';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:groups:[id]');

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
      const group = await new GroupService(auth).getById(id);

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
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Error fetching group:', error instanceof Error ? error : undefined);
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
          { error: 'Validierung fehlgeschlagen', details: validation.error.errors },
          { status: 400 }
        );
      }

      const group = await new GroupService(auth).update(id, validation.data);

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
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Error updating group:', error instanceof Error ? error : undefined);
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
      await new GroupService(auth).deactivate(id);

      return NextResponse.json({ success: true, message: 'Gruppe deaktiviert' });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Error deleting group:', error instanceof Error ? error : undefined);
      return internalErrorResponse();
    }
  });
}

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { DrizzleGroupRepository } from '@/infrastructure/persistence/repositories/group.repository';
import { GroupId, MemberId } from '@/domain/value-objects';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:groups:[id]:members:[memberId]');

const groupRepo = new DrizzleGroupRepository();

// DELETE /api/groups/[id]/members/[memberId] – Mitglied aus Gruppe entfernen
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const { id, memberId } = await params;

    try {
      await groupRepo.removeMemberFromGroup(GroupId.fromString(id), MemberId.fromString(memberId));
      return NextResponse.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error removing member from group:', message);
      return internalErrorResponse();
    }
  });
}

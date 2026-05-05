import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { DrizzleGroupRepository } from '@/infrastructure/persistence/repositories/group.repository';
import { GroupId, MemberId } from '@/domain/value-objects';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';

const groupRepo = new DrizzleGroupRepository();

// DELETE /api/groups/[id]/members/[memberId] – Mitglied aus Gruppe entfernen
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) return rateLimitError;

    const { id, memberId } = await params;

    try {
      await groupRepo.removeMemberFromGroup(GroupId.fromString(id), MemberId.fromString(memberId));
      return NextResponse.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error removing member from group:', message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

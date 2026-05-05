import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { DrizzleGroupRepository } from '@/infrastructure/persistence/repositories/group.repository';
import { GroupId, MemberId } from '@/domain/value-objects';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';
import { z } from 'zod';

const groupRepo = new DrizzleGroupRepository();

const addMemberSchema = z.object({
  memberId: z.string().uuid(),
});

// POST /api/groups/[id]/members – Mitglied zu Gruppe hinzufügen
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;

    try {
      const body = await req.json();
      const validation = addMemberSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.errors },
          { status: 400 }
        );
      }

      await groupRepo.addMemberToGroup(
        GroupId.fromString(id),
        MemberId.fromString(validation.data.memberId)
      );

      return NextResponse.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error adding member to group:', message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

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

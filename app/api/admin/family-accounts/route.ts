import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const log = createLogger('api:admin:family-accounts');

/**
 * GET /api/admin/family-accounts — list all family groups in this club
 * DELETE /api/admin/family-accounts — remove a member from a family group
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Admin access required');

    const clubId = auth.clubId;
    if (!clubId) return NextResponse.json({ error: 'No club' }, { status: 400 });

    // Fetch all family_accounts entries for users who belong to this club
    const { data: memberships, error: memberError } = await (auth.supabase as any)
      .from('user_club_memberships')
      .select('user_id')
      .eq('club_id', clubId)
      .eq('is_active', true);

    if (memberError) {
      log.error('Memberships fetch error:', memberError);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    const clubUserIds: string[] = (memberships ?? []).map((m: { user_id: string }) => m.user_id);
    if (clubUserIds.length === 0) return NextResponse.json({ groups: [] });

    const { data: familyRows, error: familyError } = await (auth.supabase as any)
      .from('family_accounts')
      .select('user_id, family_group_id, role, relationship, users(full_name, email)')
      .in('user_id', clubUserIds);

    if (familyError) {
      log.error('Family accounts fetch error:', familyError);
      return NextResponse.json({ groups: [] }); // graceful — Familienkonten nicht verfügbar
    }

    // Group by family_group_id
    const groupMap = new Map<string, { familyGroupId: string; members: unknown[] }>();
    for (const row of familyRows ?? []) {
      const gid = row.family_group_id as string;
      if (!groupMap.has(gid)) groupMap.set(gid, { familyGroupId: gid, members: [] });
      groupMap.get(gid)!.members.push({
        userId: row.user_id,
        fullName: (row.users as { full_name: string } | null)?.full_name ?? 'Unbekannt',
        email: (row.users as { email: string } | null)?.email ?? '',
        role: row.role ?? 'member',
        relationship: row.relationship ?? null,
      });
    }

    return NextResponse.json({ groups: Array.from(groupMap.values()) });
  });
}

export async function DELETE(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Admin access required');

    const { familyGroupId, userId } = await request.json();
    if (!familyGroupId || !userId) {
      return NextResponse.json({ error: 'familyGroupId and userId required' }, { status: 400 });
    }

    const { error } = await (auth.supabase as any)
      .from('family_accounts')
      .delete()
      .eq('family_group_id', familyGroupId)
      .eq('user_id', userId);

    if (error) {
      log.error('Delete family member error:', error);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}

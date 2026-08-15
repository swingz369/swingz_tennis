import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { logAudit } from '@/lib/audit';
import { createLogger } from '@/lib/logger';
import { randomUUID } from 'crypto';
import { getClubFeatures, featureDisabledResponse } from '@/lib/require-feature';

const log = createLogger('api:admin:family-accounts');

/**
 * GET /api/admin/family-accounts — list all family groups in this club
 * POST /api/admin/family-accounts — create a new family group, or add members to an existing one
 * DELETE /api/admin/family-accounts — remove a member from a family group
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Zugriff nur für Admins');

    const clubId = auth.clubId;
    if (!clubId) return NextResponse.json({ error: 'No club' }, { status: 400 });

    const features = await getClubFeatures(auth.supabase, clubId);
    if (!features.family_accounts) return featureDisabledResponse('family_accounts');

    // Service client: the RLS policy that lets admins read other users' rows
    // relies on a users.role column that no longer exists (see work-duties fix).
    const db = createServiceClient();

    const { data: memberships, error: memberError } = await db
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

    const { data: familyRows, error: familyError } = await db
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
      const userRow = Array.isArray(row.users) ? row.users[0] : row.users;
      groupMap.get(gid)!.members.push({
        userId: row.user_id,
        fullName: (userRow as { full_name?: string } | null)?.full_name ?? 'Unbekannt',
        email: (userRow as { email?: string } | null)?.email ?? '',
        role: row.role ?? 'member',
        relationship: row.relationship ?? null,
      });
    }

    return NextResponse.json({ groups: Array.from(groupMap.values()) });
  });
}

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Zugriff nur für Admins');

    const clubId = auth.clubId;
    if (!clubId) return NextResponse.json({ error: 'No club' }, { status: 400 });

    const features = await getClubFeatures(auth.supabase, clubId);
    if (!features.family_accounts) return featureDisabledResponse('family_accounts');

    const body = await request.json();
    const memberIds: string[] = Array.isArray(body.memberIds) ? body.memberIds : [];
    const familyGroupId: string | undefined = body.familyGroupId || undefined;
    const relationship: string | null = body.relationship ?? null;

    if (memberIds.length === 0) {
      return NextResponse.json({ error: 'memberIds required' }, { status: 400 });
    }

    const db = createServiceClient();

    // Members must belong to this admin's club — reject cross-club assignment.
    const { data: memberships, error: memberError } = await db
      .from('user_club_memberships')
      .select('user_id')
      .eq('club_id', clubId)
      .eq('is_active', true)
      .in('user_id', memberIds);

    if (memberError) {
      log.error('Membership check error:', memberError);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    const validIds = new Set((memberships ?? []).map((m: { user_id: string }) => m.user_id));
    const invalidIds = memberIds.filter((id) => !validIds.has(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: 'Ein oder mehrere Mitglieder gehören nicht zu diesem Verein' },
        { status: 400 }
      );
    }

    const groupId = familyGroupId || randomUUID();

    // Don't duplicate members already in this group.
    const { data: existingRows } = await db
      .from('family_accounts')
      .select('user_id')
      .eq('family_group_id', groupId);
    const existingIds = new Set((existingRows ?? []).map((r: { user_id: string }) => r.user_id));
    const toInsert = memberIds.filter((id) => !existingIds.has(id));

    if (toInsert.length === 0) {
      return NextResponse.json({ familyGroupId: groupId, added: 0 });
    }

    const { error: insertError } = await db.from('family_accounts').insert(
      toInsert.map((userId) => ({
        user_id: userId,
        family_group_id: groupId,
        role: 'member',
        relationship,
      }))
    );

    if (insertError) {
      log.error('Family account insert error:', insertError);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    await logAudit({
      actorId: auth.user.id,
      action: familyGroupId ? 'family_account_member_added' : 'family_account_created',
      resourceType: 'family_group',
      resourceId: groupId,
      clubId,
      details: { memberIds: toInsert, relationship },
      request,
    });

    return NextResponse.json({ familyGroupId: groupId, added: toInsert.length });
  });
}

export async function DELETE(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Zugriff nur für Admins');

    const { familyGroupId, userId } = await request.json();
    if (!familyGroupId || !userId) {
      return NextResponse.json({ error: 'familyGroupId and userId required' }, { status: 400 });
    }

    const db = createServiceClient();
    const { error } = await db
      .from('family_accounts')
      .delete()
      .eq('family_group_id', familyGroupId)
      .eq('user_id', userId);

    if (error) {
      log.error('Delete family member error:', error);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    await logAudit({
      actorId: auth.user.id,
      action: 'family_account_member_removed',
      resourceType: 'family_group',
      resourceId: familyGroupId,
      clubId: auth.clubId,
      details: { removedUserId: userId },
      request,
    });

    return NextResponse.json({ success: true });
  });
}

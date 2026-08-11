import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';
import { getClubFeatures, featureDisabledResponse } from '@/lib/require-feature';

const log = createLogger('api:family-accounts');

// GET: List family members
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const { supabase, user } = auth;

    if (auth.clubId) {
      const features = await getClubFeatures(supabase, auth.clubId);
      if (!features.family_accounts) return featureDisabledResponse('family_accounts');
    }

    // Get family group for this user
    const { data: familyLink } = await (supabase as any)
      .from('family_accounts')
      .select('family_group_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!familyLink) {
      return NextResponse.json({ familyMembers: [] });
    }

    // Get all members in the family group, including user details and role
    const { data: familyMembers } = await (supabase as any)
      .from('family_accounts')
      .select('user_id, relationship, role, users(full_name, email, date_of_birth)')
      .eq('family_group_id', familyLink.family_group_id)
      .order('created_at');

    // Get active invite code for this family group
    const { data: invite } = await (supabase as any)
      .from('family_invites')
      .select('code')
      .eq('family_group_id', familyLink.family_group_id)
      .eq('is_used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      familyGroupId: familyLink.family_group_id,
      inviteCode: invite?.code ?? null,
      currentUserId: user.id,
      members: (familyMembers || []).map((m: any) => ({
        userId: m.user_id,
        fullName: (m.users as any)?.full_name || 'Unbekannt',
        email: (m.users as any)?.email || '',
        role: m.role || 'member',
        relationship: m.relationship,
        dateOfBirth: (m.users as any)?.date_of_birth ?? null,
        isSelf: m.user_id === user.id,
      })),
    });
  });
}

// POST: Add family member (via invite code)
export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const { supabase, user } = auth;

    if (auth.clubId) {
      const features = await getClubFeatures(supabase, auth.clubId);
      if (!features.family_accounts) return featureDisabledResponse('family_accounts');
    }

    const { inviteCode } = await request.json();

    if (inviteCode) {
      // Joining via invite code
      const { data: invite } = await (supabase as any)
        .from('family_invites')
        .select('*')
        .eq('code', inviteCode.toUpperCase().trim())
        .eq('is_used', false)
        .maybeSingle();

      if (!invite) {
        return NextResponse.json(
          { error: 'Ungültiger oder bereits verwendeter Code' },
          { status: 400 }
        );
      }

      // Add to family group — if user is a minor (has date_of_birth < 18), mark as child
      const { data: userData } = await supabase
        .from('users')
        .select('date_of_birth')
        .eq('id', user.id)
        .maybeSingle();
      const dob = userData?.date_of_birth;
      const isMinor = dob
        ? (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000) < 18
        : false;
      await (supabase as any).from('family_accounts').insert({
        family_group_id: invite.family_group_id,
        user_id: user.id,
        relationship: 'family',
        role: isMinor ? 'child' : 'member',
      });

      // Mark invite as used
      await (supabase as any)
        .from('family_invites')
        .update({ is_used: true, used_by: user.id })
        .eq('id', invite.id);

      return NextResponse.json({ success: true, message: 'Familienmitglied hinzugefügt' });
    }

    // Creating a new family group
    const { data: existingLink } = await (supabase as any)
      .from('family_accounts')
      .select('family_group_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingLink) {
      return NextResponse.json({ error: 'Bereits Teil einer Familie' }, { status: 409 });
    }

    // Create family group and add self as parent
    const familyGroupId = crypto.randomUUID();
    await (supabase as any).from('family_accounts').insert({
      family_group_id: familyGroupId,
      user_id: user.id,
      relationship: 'primary',
      role: 'parent',
    });

    // Generate invite code
    const newInviteCode = `FAM${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    await (supabase as any).from('family_invites').insert({
      family_group_id: familyGroupId,
      code: newInviteCode,
      created_by: user.id,
    });

    return NextResponse.json({
      success: true,
      familyGroupId,
      inviteCode: newInviteCode,
      message: 'Familie erstellt! Teile diesen Code mit deinen Familienmitgliedern',
    });
  });
}

// PUT: Generate a new invite code (invalidates old unused codes)
export async function PUT(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const { supabase, user } = auth;

    if (auth.clubId) {
      const features = await getClubFeatures(supabase, auth.clubId);
      if (!features.family_accounts) return featureDisabledResponse('family_accounts');
    }

    const { data: familyLink } = await (supabase as any)
      .from('family_accounts')
      .select('family_group_id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!familyLink) {
      log.warn('No family account found for user', { userId: user.id });
      return NextResponse.json({ error: 'Kein Familienkonto vorhanden' }, { status: 404 });
    }
    if (familyLink.role !== 'parent') {
      return NextResponse.json(
        { error: 'Nur Elternteile können neue Codes erstellen' },
        { status: 403 }
      );
    }

    // Invalidate existing unused codes
    await (supabase as any)
      .from('family_invites')
      .update({ is_used: true })
      .eq('family_group_id', familyLink.family_group_id)
      .eq('is_used', false);

    const newCode = `FAM${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    await (supabase as any).from('family_invites').insert({
      family_group_id: familyLink.family_group_id,
      code: newCode,
      created_by: user.id,
    });

    return NextResponse.json({ success: true, inviteCode: newCode });
  });
}

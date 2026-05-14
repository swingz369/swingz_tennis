import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) {
      return forbiddenResponse('Member access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      // Use Supabase directly instead of repository to avoid domain layer issues
      const supabase = await createClient();

      // CRITICAL: Scope clubs based on user role
      // - Superadmin: sees ALL clubs
      // - Admin/Trainer/Member: sees only their own club(s)
      const isSuperadmin = auth.role === 'superadmin';

      let clubsQuery = supabase
        .from('clubs')
        .select('id, name, status, max_members, created_at')
        .order('created_at', { ascending: false });

      if (!isSuperadmin) {
        // Filter to clubs where user has membership
        const userClubIds = auth.memberships
          .map((m) => m.club_id)
          .filter((id): id is string => id !== null);
        console.log('[API /clubs] Non-superadmin user, filtering to clubs:', userClubIds);
        clubsQuery = clubsQuery.in('id', userClubIds);
      } else {
        console.log('[API /clubs] Superadmin user, returning all clubs');
      }

      const { data: clubs, error } = await clubsQuery;

      if (error) {
        console.error('[API /clubs] Database error:', error);
        return NextResponse.json({ error: 'Failed to fetch clubs' }, { status: 500 });
      }

      // Get member counts for each club (optimized single query)
      const clubIds = clubs?.map((c) => c.id) || [];
      const memberCounts: Record<string, number> = {};

      if (clubIds.length > 0) {
        const { data: memberships } = await supabase
          .from('user_club_memberships')
          .select('club_id')
          .in('club_id', clubIds)
          .eq('is_active', true);

        memberships?.forEach((m) => {
          if (m.club_id) {
            memberCounts[m.club_id] = (memberCounts[m.club_id] || 0) + 1;
          }
        });
      }

      console.log('[API /clubs] Returning', clubs?.length || 0, 'clubs for user role:', auth.role);

      return NextResponse.json(
        (clubs || []).map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status || 'active',
          memberCount: memberCounts[c.id] || 0,
          maxMembers: c.max_members || 100,
        }))
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[API /clubs] Error listing clubs:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'superadmin');
    if (!hasRole) {
      return forbiddenResponse('Superadmin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      const body = await req.json();
      const { name, maxMembers, openingHours } = body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Club name is required' }, { status: 400 });
      }

      const supabase = await createClient();

      // Check if club with same name exists
      const { data: existing } = await supabase
        .from('clubs')
        .select('id')
        .eq('name', name)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ error: 'Club with this name already exists' }, { status: 400 });
      }

      // Create club
      const { data: newClub, error } = await supabase
        .from('clubs')
        .insert({
          name: name.trim(),
          max_members: maxMembers || 100,
          opening_hours: openingHours || {},
          status: 'active',
        })
        .select('id, name')
        .single();

      if (error) {
        console.error('[API /clubs] Error creating club:', error);
        return NextResponse.json({ error: 'Failed to create club' }, { status: 500 });
      }

      console.log('[API /clubs] Club created:', newClub.id, newClub.name);

      return NextResponse.json(
        {
          clubId: newClub.id,
          name: newClub.name,
        },
        { status: 201 }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[API /clubs] Error creating club:', error);
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}

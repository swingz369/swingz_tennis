import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { buildPaginationMeta } from '@/lib/pagination';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:clubs');

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

      // Pagination params
      const url = new URL(req.url);
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
      const limit = Math.min(
        100,
        Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20)
      );
      const offset = (page - 1) * limit;

      // CRITICAL: Scope clubs based on user role
      // - Owner: sees ALL clubs
      // - Superadmin: sees only clubs their Tennisschule manages (real
      //   user_club_memberships rows with role='superadmin', one per club)
      // - Admin/Trainer/Member: sees only their own club(s)
      const isOwner = auth.role === 'owner';

      let clubsQuery = supabase
        .from('clubs')
        .select('id, name, status, max_members, created_at')
        .order('created_at', { ascending: false });

      let countQuery = supabase.from('clubs').select('id', { count: 'exact', head: true });

      if (!isOwner) {
        // Filter to clubs where user has membership (covers superadmin's
        // per-club rows, admin's single club, trainer/member's club).
        const userClubIds = auth.memberships
          .map((m) => m.club_id)
          .filter((id): id is string => id !== null);
        log.info('Non-owner user, filtering to clubs', { clubIds: userClubIds });
        clubsQuery = clubsQuery.in('id', userClubIds);
        countQuery = countQuery.in('id', userClubIds);
      } else {
        log.info('Owner user, returning all clubs');
      }

      const [{ data: clubs, error }, { count }] = await Promise.all([
        clubsQuery.range(offset, offset + limit - 1),
        countQuery,
      ]);

      if (error) {
        log.error('Database error', error instanceof Error ? error : undefined);
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

      log.info('Returning clubs', { count: clubs?.length || 0, role: auth.role });

      const pagination = buildPaginationMeta(page, limit, count);

      return NextResponse.json({
        clubs: (clubs || []).map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status || 'active',
          memberCount: memberCounts[c.id] || 0,
          maxMembers: c.max_members || 100,
        })),
        pagination,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error listing clubs', error instanceof Error ? error : undefined);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = (await verifyRole(auth, 'superadmin')) || (await verifyRole(auth, 'owner'));
    if (!hasRole) {
      return forbiddenResponse('Superadmin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      const body = await req.json();
      const { name, city, maxMembers, openingHours } = body;

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

      // Owner creates clubs as active; superadmin-created clubs start as pending (needs owner approval)
      const status = auth.role === 'owner' ? 'active' : 'pending';

      // Create club
      const { data: newClub, error } = await supabase
        .from('clubs')
        .insert({
          name: name.trim(),
          ...(city ? { city: city.trim() } : {}),
          max_members: maxMembers || 100,
          opening_hours: openingHours || {},
          status,
        })
        .select('id, name')
        .single();

      if (error) {
        log.error('Error creating club', error instanceof Error ? error : undefined);
        return NextResponse.json({ error: 'Failed to create club' }, { status: 500 });
      }

      log.info('Club created', { clubId: newClub.id, name: newClub.name });

      // Give superadmin a superadmin membership on the new club — same shape as
      // a club the owner explicitly assigns to them (owner/superadmins page),
      // so club-scoping checks (verifyClubAccess, resolveActiveClub) treat a
      // self-created club exactly like an assigned one.
      // Owner skipped — they see all clubs via platform-level access, not club memberships.
      if (auth.role === 'superadmin') {
        const serviceSb = createServiceClient();
        await serviceSb
          .from('user_club_memberships')
          .upsert(
            { user_id: auth.user.id, club_id: newClub.id, role: 'superadmin', is_active: true },
            { onConflict: 'user_id,club_id' }
          );
      }

      return NextResponse.json(
        {
          clubId: newClub.id,
          club: { id: newClub.id, name: newClub.name },
          name: newClub.name,
        },
        { status: 201 }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error('Error creating club', error instanceof Error ? error : undefined);
      return NextResponse.json({ error: message }, { status: 400 });
    }
  });
}

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { getUserDb, systemDb } from '@/infrastructure/db';
import { authorizeSeasonAccess } from '@/lib/season-auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:planning:members');

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, { max: 30, windowMs: 60000 });
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;

      // 1. Saison + Vereinszugriff (Superadmin nur für zugewiesene Vereine)
      const access = await authorizeSeasonAccess(auth, seasonId);
      if (!access.ok) return access.response;
      const { season } = access;

      const sb =
        auth.role === 'owner' ? systemDb('Owner: Saisonplanung aller Vereine') : getUserDb(auth);

      // 2. Get active members for this club
      const { data: memberships, error: membErr } = await sb
        .from('user_club_memberships')
        .select('user_id, include_in_planning')
        .eq('club_id', season.club_id)
        .eq('role', 'member')
        .eq('is_active', true);

      if (membErr) {
        log.error('Failed to load memberships', membErr);
        return NextResponse.json(
          { error: 'Mitglieder konnten nicht geladen werden' },
          { status: 500 }
        );
      }

      const memberIds = (memberships ?? []).map((m) => m.user_id);

      if (memberIds.length === 0) {
        return NextResponse.json({
          success: true,
          members: [],
          promotedMembers: [],
          waitlistCarryovers: [],
          totalCount: 0,
          submittedCount: 0,
        });
      }

      // 3. Get user details
      const { data: userRows } = await sb
        .from('users')
        .select('id, full_name, email, skill_level, experience_months')
        .in('id', memberIds);

      const userMap = new Map((userRows ?? []).map((u: any) => [u.id, u]));

      // 4. Get training preferences for this season
      const { data: prefRows } = await sb
        .from('user_training_preferences')
        .select('user_id, is_submitted')
        .eq('season_id', seasonId)
        .in('user_id', memberIds);

      const prefMap = new Map((prefRows ?? []).map((p: any) => [p.user_id, p]));

      const planningMap = new Map(
        (memberships ?? []).map((m) => [m.user_id, m.include_in_planning])
      );

      const members = memberIds.map((uid) => {
        const u = userMap.get(uid) as any;
        const p = prefMap.get(uid) as any;
        return {
          id: uid,
          name: u?.full_name || u?.email || 'Unbekannt',
          email: u?.email || '',
          skillLevel: u?.skill_level || 'beginner',
          experienceMonths: u?.experience_months || 0,
          isSubmitted: !!p?.is_submitted,
          includeInPlanning: planningMap.get(uid) ?? true,
          isPromoted: false,
          isWaitlistCarryover: false,
        };
      });

      return NextResponse.json({
        success: true,
        members,
        promotedMembers: [],
        waitlistCarryovers: [],
        totalCount: members.length,
        submittedCount: members.filter((m) => m.isSubmitted).length,
      });
    } catch (error) {
      log.error('GET /api/seasons/[id]/planning/members error:', error);
      return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
    }
  });
}

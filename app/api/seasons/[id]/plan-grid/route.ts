import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/src/infrastructure/persistence/db';
import {
  seasonPlanEntries,
  trainers,
  courts,
  groups,
} from '@/src/infrastructure/persistence/schema';
import { and, eq } from 'drizzle-orm';
import { createLogger } from '@/lib/logger';
import { authorizeSeasonAccess } from '@/lib/season-auth';

const log = createLogger('api:seasons:[id]:plan-grid');

const GROUP_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0891b2',
  '#4f46e5',
  '#9333ea',
  '#c026d3',
  '#e11d48',
];

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;

      // Centralized authorization: the helper looks up the season, verifies
      // the caller's club membership matches the season's club, and checks
      // the per-club role against `allowedRoles`. Superadmin & owner bypass
      // the membership check via the platform-staff fast path.
      //
      // Allowed roles: 'admin' (full read), 'trainer' (read own session
      // grid), 'member' (read own schedule). Owners and superadmins bypass
      // via the helper's platform-staff fast path.
      const access = await authorizeSeasonAccess(auth, seasonId, {
        allowedRoles: ['admin', 'trainer', 'member'],
      });
      if (!access.ok) return access.response;
      const { season, effectiveRole } = access;

      // Only admins (and platform staff, effectiveRole='owner'/'superadmin'
      // via the helper's fast path) get the unfiltered grid. Trainers and
      // members are scoped below, after slots are built, to their own data —
      // this endpoint has no UI caller today (the admin grid is the only
      // consumer), but it's reachable directly by any authorized club role,
      // so it must not leak other people's names.
      let ownTrainerId: string | null = null;
      if (effectiveRole === 'trainer') {
        const [trainerRow] = await db
          .select({ id: trainers.id })
          .from(trainers)
          .where(eq(trainers.user_id, auth.user.id))
          .limit(1);
        ownTrainerId = trainerRow?.id ?? null;
      }

      // 2) Groups for this club (the FK season_plan_entries.group_id → groups.id)
      let allGroups;
      try {
        allGroups = await db
          .select()
          .from(groups)
          .where(and(eq(groups.club_id, season.club_id), eq(groups.is_active, true)));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : '';
        log.error(
          'plan-grid: groups query failed',
          err instanceof Error ? err : { message: msg, stack }
        );
        return NextResponse.json(
          { error: `Database error loading groups: ${msg}` },
          { status: 500 }
        );
      }

      const colorMap = new Map<string, string>();
      allGroups.forEach((g, i) => {
        colorMap.set(g.id, GROUP_COLORS[i % GROUP_COLORS.length]);
      });

      // 3) Courts for this club
      let clubCourts;
      try {
        clubCourts = await db
          .select({ id: courts.id, name: courts.name })
          .from(courts)
          .where(eq(courts.club_id, season.club_id));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : '';
        log.error(
          'plan-grid: courts query failed',
          err instanceof Error ? err : { message: msg, stack }
        );
        return NextResponse.json(
          { error: `Database error loading courts: ${msg}` },
          { status: 500 }
        );
      }

      // 4) Plan entries with training-group + trainer + court details
      let entries;
      try {
        entries = await db
          .select({
            entry: seasonPlanEntries,
            trainer_name: trainers.name,
            court_name: courts.name,
            group_name: groups.name,
          })
          .from(seasonPlanEntries)
          .leftJoin(trainers, eq(seasonPlanEntries.trainer_id, trainers.id))
          .leftJoin(courts, eq(seasonPlanEntries.court_id, courts.id))
          .leftJoin(groups, eq(seasonPlanEntries.group_id, groups.id))
          .where(eq(seasonPlanEntries.season_id, seasonId))
          .orderBy(seasonPlanEntries.day_of_week, seasonPlanEntries.start_time);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : '';
        log.error(
          'plan-grid: entries query failed',
          err instanceof Error ? err : { message: msg, stack }
        );
        return NextResponse.json(
          { error: `Database error loading plan entries: ${msg}` },
          { status: 500 }
        );
      }

      const slots = entries.map((row) => ({
        id: row.entry.id,
        group_id: row.entry.group_id,
        group_name: row.group_name || 'Unbekannte Gruppe',
        group_color: row.entry.group_id ? colorMap.get(row.entry.group_id) || '#6b7280' : '#6b7280',
        trainer_id: row.entry.trainer_id,
        trainer_name: row.trainer_name || 'Unbekannt',
        substitute_trainer_id: row.entry.substitute_trainer_id,
        court_id: row.entry.court_id,
        court_name: row.court_name || null,
        day_of_week: row.entry.day_of_week,
        start_time: row.entry.start_time.substring(0, 5),
        end_time: row.entry.end_time.substring(0, 5),
        duration_min: row.entry.duration_minutes,
        member_ids: row.entry.expected_participants || [],
        member_count: Array.isArray(row.entry.expected_participants)
          ? row.entry.expected_participants.length
          : 0,
        status: row.entry.status,
      }));

      const scopedSlots =
        effectiveRole === 'trainer'
          ? slots.filter(
              (s) => s.trainer_id === ownTrainerId || s.substitute_trainer_id === ownTrainerId
            )
          : effectiveRole === 'member'
            ? slots.filter(
                (s) => Array.isArray(s.member_ids) && s.member_ids.includes(auth.user.id)
              )
            : slots;

      return NextResponse.json({
        slots: scopedSlots,
        groups: allGroups.map((g) => ({
          id: g.id,
          name: g.name,
          color: colorMap.get(g.id) || '#6b7280',
          level: g.level,
          age_group: g.age_group,
        })),
        courts: clubCourts,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : '';
      log.error(
        'GET /api/seasons/[id]/plan-grid error',
        error instanceof Error ? error : { message: msg, stack }
      );
      return NextResponse.json({ error: `Failed to fetch plan grid: ${msg}` }, { status: 500 });
    }
  });
}

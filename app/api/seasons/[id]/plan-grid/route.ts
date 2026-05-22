import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { getDb } from '@/src/infrastructure/persistence/client';
import {
  seasons,
  seasonPlanEntries,
  trainers,
  courts,
  groups,
} from '@/src/infrastructure/persistence/schema';
import { and, eq } from 'drizzle-orm';

const GROUP_COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#dc2626',
  '#ea580c', '#ca8a04', '#16a34a', '#0891b2',
  '#4f46e5', '#9333ea', '#c026d3', '#e11d48',
];

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async () => {
    try {
      const { id: seasonId } = await context.params;
      const db = getDb();

      const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
      if (!season) {
        return NextResponse.json({ error: 'Season not found' }, { status: 404 });
      }

      // Get all active groups for this club
      const allGroups = await db
        .select()
        .from(groups)
        .where(and(eq(groups.club_id, season.club_id), eq(groups.is_active, true)));

      const colorMap = new Map<string, string>();
      allGroups.forEach((g, i) => {
        colorMap.set(g.id, GROUP_COLORS[i % GROUP_COLORS.length]);
      });

      // Get all courts for this club
      const clubCourts = await db
        .select({ id: courts.id, name: courts.name })
        .from(courts)
        .where(eq(courts.club_id, season.club_id));

      // Get plan entries with details
      const entries = await db
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

      const slots = entries.map((row) => ({
        id: row.entry.id,
        group_id: row.entry.group_id,
        group_name: row.group_name || 'Unbekannte Gruppe',
        group_color: row.entry.group_id ? colorMap.get(row.entry.group_id) || '#6b7280' : '#6b7280',
        trainer_id: row.entry.trainer_id,
        trainer_name: row.trainer_name || 'Unbekannt',
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

      return NextResponse.json({
        slots,
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
      console.error('GET /api/seasons/[id]/plan-grid error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch plan grid' },
        { status: 500 }
      );
    }
  });
}

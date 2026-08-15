import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { db } from '@/src/infrastructure/persistence/db';
import {
  seasonPlanEntries,
  groups,
  trainers,
  courts,
  seasons,
} from '@/src/infrastructure/persistence/schema';
import { and, eq, sql, asc } from 'drizzle-orm';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:user:member:groups');

/**
 * GET /api/user/member/groups[?clubId=...]
 *
 * Die Trainingsgruppen des angemeldeten Mitglieds.
 *
 * Die Route las früher `training_group_memberships` — eine Tabelle, die die
 * Saisonplanung nie beschreibt (sie füllt `season_plan_entries.expected_participants`
 * und `bookings`). Sie lieferte deshalb für jedes Mitglied eine leere Liste, und
 * keine Oberfläche rief sie auf. Grundlage ist jetzt der Saisonplan, dieselbe
 * Quelle, aus der auch Trainer-Ansicht und Abrechnung lesen.
 */
export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Mitglieder');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    // clubId ist optional: Für Mitglieder mit genau einem Verein steht er im
    // Auth-Kontext, ein Parameter ist dann überflüssig.
    const clubId = req.nextUrl.searchParams.get('clubId') ?? auth.clubId;
    if (!clubId) {
      return NextResponse.json({ error: 'Kein Verein ausgewählt' }, { status: 400 });
    }

    try {
      const rows = await db
        .select({
          groupId: seasonPlanEntries.group_id,
          groupName: groups.name,
          dayOfWeek: seasonPlanEntries.day_of_week,
          startTime: seasonPlanEntries.start_time,
          endTime: seasonPlanEntries.end_time,
          trainerName: trainers.name,
          courtName: courts.name,
          participants: seasonPlanEntries.expected_participants,
          seasonName: seasons.name,
          seasonStatus: seasons.planning_status,
        })
        .from(seasonPlanEntries)
        .leftJoin(groups, eq(seasonPlanEntries.group_id, groups.id))
        .leftJoin(trainers, eq(seasonPlanEntries.trainer_id, trainers.id))
        .leftJoin(courts, eq(seasonPlanEntries.court_id, courts.id))
        .leftJoin(seasons, eq(seasonPlanEntries.season_id, seasons.id))
        .where(
          and(
            eq(seasonPlanEntries.club_id, clubId),
            sql`${seasonPlanEntries.expected_participants} @> ${JSON.stringify([auth.user.id])}::jsonb`
          )
        )
        .orderBy(asc(seasonPlanEntries.day_of_week), asc(seasonPlanEntries.start_time));

      const groupList = rows.map((r) => ({
        id: r.groupId,
        name: r.groupName ?? 'Trainingsgruppe',
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
        trainerName: r.trainerName ?? null,
        courtName: r.courtName ?? null,
        participantCount: ((r.participants as string[] | null) ?? []).length,
        seasonName: r.seasonName ?? null,
        isPublished: r.seasonStatus === 'published',
      }));

      return NextResponse.json({
        groups: groupList,
        // Rückwärtskompatibel: die alte Antwortform war eine reine ID-Liste.
        groupIds: groupList.map((g) => g.id).filter(Boolean),
      });
    } catch (error) {
      log.error('Gruppen des Mitglieds konnten nicht geladen werden', error);
      return NextResponse.json({ error: 'Failed to fetch group memberships' }, { status: 500 });
    }
  });
}

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { db } from '@/src/infrastructure/persistence/db';
import {
  seasons,
  seasonPlanEntries,
  trainers,
  sessions,
} from '@/src/infrastructure/persistence/schema';
import { eq, and, isNotNull, inArray, gte, lte, asc } from 'drizzle-orm';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:planning:substitutes');

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function requireAdminAccess(
  auth: Parameters<Parameters<typeof withApiAuth>[1]>[0],
  seasonId: string
) {
  const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
  if (!season)
    return { error: NextResponse.json({ error: 'Saison nicht gefunden' }, { status: 404 }) };

  const isAdmin = await verifyRole(auth, 'admin');
  const isSuperadmin = await verifyRole(auth, 'superadmin');
  if (!isAdmin && !isSuperadmin) return { error: forbiddenResponse('Nur Admins') };
  if (!isSuperadmin) {
    const hasClubAccess = auth.memberships.some(
      (m) => m.club_id === season.club_id && (m.role === 'admin' || m.role === 'superadmin')
    );
    if (!hasClubAccess) return { error: forbiddenResponse('Kein Zugriff auf diesen Club') };
  }
  return { season };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, { max: 30, windowMs: 60000 });
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;
      const access = await requireAdminAccess(auth, seasonId);
      if (access.error) return access.error;

      const entries = await db
        .select({
          groupId: seasonPlanEntries.group_id,
          substituteTrainerId: seasonPlanEntries.substitute_trainer_id,
          fromWeek: seasonPlanEntries.substitute_from_week,
          toWeek: seasonPlanEntries.substitute_to_week,
          trainerName: trainers.name,
        })
        .from(seasonPlanEntries)
        .leftJoin(trainers, eq(seasonPlanEntries.substitute_trainer_id, trainers.id))
        .where(
          and(
            eq(seasonPlanEntries.season_id, seasonId),
            isNotNull(seasonPlanEntries.substitute_trainer_id)
          )
        );

      const substitutes = entries
        .filter((e) => e.groupId)
        .map((e) => ({
          groupId: e.groupId,
          groupName: e.groupId,
          fromWeek: e.fromWeek ?? 1,
          toWeek: e.toWeek ?? 26,
          substituteTrainerId: e.substituteTrainerId,
          substituteTrainerName: e.trainerName ?? 'Unbekannt',
        }));

      return NextResponse.json({ substitutes });
    } catch (error) {
      log.error('GET substitutes error', error instanceof Error ? error : undefined);
      return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, { max: 10, windowMs: 60000 });
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;
      const access = await requireAdminAccess(auth, seasonId);
      if (access.error) return access.error;

      const body = await request.json();
      const { groupId, fromWeek, toWeek, substituteTrainerId } = body;
      if (!groupId || !substituteTrainerId) {
        return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400 });
      }

      // `.returning()` statt blindem Update: Traf die Bedingung keine Zeile (etwa
      // bei einer Gruppen-ID, die es in dieser Saison nicht gibt), meldete die
      // Route bisher trotzdem Erfolg samt Trainername — grün, ohne geprüft zu haben.
      const updated = await db
        .update(seasonPlanEntries)
        .set({
          substitute_trainer_id: substituteTrainerId,
          substitute_from_week: fromWeek ?? 1,
          substitute_to_week: toWeek ?? 26,
        })
        .where(
          and(eq(seasonPlanEntries.season_id, seasonId), eq(seasonPlanEntries.group_id, groupId))
        )
        .returning({ id: seasonPlanEntries.id });

      if (updated.length === 0) {
        return NextResponse.json(
          { error: 'Zu dieser Gruppe gibt es in dieser Saison keinen Trainingstermin' },
          { status: 404 }
        );
      }

      // Der Admin denkt in Terminen („die nächsten drei Einheiten"), das System
      // rechnet in Kalenderwochen ab Saisonbeginn — und zählt Ferienwochen mit.
      // Welche Termine tatsächlich betroffen sind, ist ohne Datum nicht erkennbar.
      // Ist die Saison veröffentlicht, stehen die echten Termine in `sessions`.
      const seasonStart = new Date(access.season.start_date as unknown as string);
      const rangeStart = new Date(seasonStart);
      rangeStart.setDate(rangeStart.getDate() + ((fromWeek ?? 1) - 1) * 7);
      const rangeEnd = new Date(seasonStart);
      rangeEnd.setDate(rangeEnd.getDate() + (toWeek ?? 26) * 7);

      const affected = await db
        .select({ start: sessions.timeslot_start })
        .from(sessions)
        .where(
          and(
            inArray(
              sessions.plan_entry_id,
              updated.map((u) => u.id)
            ),
            gte(sessions.timeslot_start, rangeStart),
            lte(sessions.timeslot_start, rangeEnd)
          )
        )
        .orderBy(asc(sessions.timeslot_start));

      const [trainer] = await db
        .select({ name: trainers.name })
        .from(trainers)
        .where(eq(trainers.id, substituteTrainerId))
        .limit(1);

      log.info('Substitute trainer assigned', { seasonId, groupId, substituteTrainerId });
      return NextResponse.json({
        success: true,
        affectedDates: affected.map((a) => a.start),
        substitute: {
          groupId,
          groupName: groupId,
          fromWeek: fromWeek ?? 1,
          toWeek: toWeek ?? 26,
          substituteTrainerId,
          substituteTrainerName: trainer?.name ?? 'Unbekannt',
        },
      });
    } catch (error) {
      log.error('POST substitutes error', error instanceof Error ? error : undefined);
      return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
    }
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, { max: 10, windowMs: 60000 });
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;
      const access = await requireAdminAccess(auth, seasonId);
      if (access.error) return access.error;

      const body = await request.json();
      const { groupId } = body;
      if (!groupId) return NextResponse.json({ error: 'groupId fehlt' }, { status: 400 });

      await db
        .update(seasonPlanEntries)
        .set({ substitute_trainer_id: null, substitute_from_week: null, substitute_to_week: null })
        .where(
          and(eq(seasonPlanEntries.season_id, seasonId), eq(seasonPlanEntries.group_id, groupId))
        );

      log.info('Substitute trainer removed', { seasonId, groupId });
      return NextResponse.json({ success: true });
    } catch (error) {
      log.error('DELETE substitutes error', error instanceof Error ? error : undefined);
      return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
    }
  });
}

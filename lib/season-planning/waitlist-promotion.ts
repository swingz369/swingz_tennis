/**
 * Nachrücken von der Saison-Warteliste.
 *
 * Zwei Wartelisten dürfen nicht verwechselt werden: `session_waitlist` gilt für
 * einen einzelnen Termin (dort rückt der Absagepfad in
 * `app/api/bookings/[id]/cancel` bereits automatisch nach). Diese Funktion
 * betrifft `season_waitlists` — die Zuteilung zu einer Trainingsgruppe für die
 * ganze Saison.
 *
 * Aufgerufen wird sie, wenn im Plan ein Platz frei wird. Ein Mitglied rückt nur
 * dann nach, wenn in **allen** Terminen der Gruppe Platz ist: Eine Gruppe mit
 * zwei Einheiten pro Woche ist eine Einheit, kein halber Platz.
 */
import { db } from '@/src/infrastructure/persistence/db';
import { seasonPlanEntries } from '@/src/infrastructure/persistence/schema';
import { seasonWaitlists } from '@/src/infrastructure/persistence/season-planning-schema';
import { and, eq, asc } from 'drizzle-orm';
import { createLogger } from '@/lib/logger';

const log = createLogger('season-waitlist-promotion');

export type PromotionResult = { memberId: string; position: number }[];

export async function promoteFromSeasonWaitlist(
  seasonId: string,
  groupId: string
): Promise<PromotionResult> {
  const entries = await db
    .select({
      id: seasonPlanEntries.id,
      participants: seasonPlanEntries.expected_participants,
      maxParticipants: seasonPlanEntries.max_participants,
    })
    .from(seasonPlanEntries)
    .where(and(eq(seasonPlanEntries.season_id, seasonId), eq(seasonPlanEntries.group_id, groupId)));

  if (entries.length === 0) return [];

  // Freie Plätze = das Minimum über alle Termine der Gruppe.
  const freeSeats = Math.min(
    ...entries.map((e) => {
      const current = ((e.participants as string[] | null) ?? []).length;
      return Math.max(0, (e.maxParticipants ?? 0) - current);
    })
  );
  if (freeSeats <= 0) return [];

  const waiting = await db
    .select({
      id: seasonWaitlists.id,
      memberId: seasonWaitlists.member_id,
      position: seasonWaitlists.position,
    })
    .from(seasonWaitlists)
    .where(
      and(
        eq(seasonWaitlists.season_id, seasonId),
        eq(seasonWaitlists.group_id, groupId),
        eq(seasonWaitlists.status, 'waiting')
      )
    )
    .orderBy(asc(seasonWaitlists.position));

  const promoted: PromotionResult = [];

  for (const candidate of waiting.slice(0, freeSeats)) {
    for (const entry of entries) {
      const participants = ((entry.participants as string[] | null) ?? []).slice();
      if (participants.includes(candidate.memberId)) continue;
      participants.push(candidate.memberId);
      entry.participants = participants as never;
      await db
        .update(seasonPlanEntries)
        .set({ expected_participants: participants })
        .where(eq(seasonPlanEntries.id, entry.id));
    }

    await db
      .update(seasonWaitlists)
      .set({ status: 'accepted', accepted_at: new Date() })
      .where(eq(seasonWaitlists.id, candidate.id));

    promoted.push({ memberId: candidate.memberId, position: candidate.position ?? 0 });
  }

  if (promoted.length > 0) {
    log.info('Von der Warteliste nachgerückt', { seasonId, groupId, members: promoted.length });
  }

  return promoted;
}

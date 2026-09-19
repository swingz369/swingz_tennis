/**
 * Berechnet aus einem Saisonplan die zu schreibenden Zeilen (Sessions, Buchungen, Eintrags-
 * Updates). Reine Funktion ohne Datenbank — geschrieben wird atomar von `publish_season_plan`.
 */
import { randomUUID } from 'node:crypto';
import type { Tables } from '@/types/supabase';
import { berlinWallClock } from '@/lib/berlin-time';
import { isDateInHolidays, type Holiday } from '@/lib/season-planning/holidays';

type Season = Tables<'seasons'>;
type PlanEntry = Tables<'season_plan_entries'>;

export interface PublishPlan {
  schedule: {
    season_type: 'winter' | 'summer';
    season_year: number;
    season_start_date: string;
    season_end_date: string;
  };
  sessions: Array<Record<string, unknown> & { id: string }>;
  bookings: Array<Record<string, unknown>>;
  /** Planeintrag → erste erzeugte Session. */
  entryUpdates: Array<{ id: string; sid: string }>;
}

export interface BuildPublishPlanInput {
  season: Season;
  entries: PlanEntry[];
  holidays: Holiday[];
  /** Schlüssel `${group_id}|${week_number}` der ausgesetzten Gruppenwochen. */
  inactiveWeeks: Set<string>;
  isRepublish: boolean;
  now: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Erster Termin des Wochentags (0=Montag … 6=Sonntag) am/nach Saisonbeginn, UTC-Mitternacht. */
function firstOccurrence(seasonStart: Date, dayOfWeek: number): Date {
  const jsDay = dayOfWeek === 6 ? 0 : dayOfWeek + 1;
  const first = new Date(seasonStart);
  let diff = jsDay - first.getUTCDay();
  if (diff < 0) diff += 7;
  first.setUTCDate(first.getUTCDate() + diff);
  first.setUTCHours(0, 0, 0, 0);
  return first;
}

export function buildPublishPlan(input: BuildPublishPlanInput): PublishPlan {
  const { season, entries, holidays, inactiveWeeks, isRepublish, now } = input;

  let seasonStart = season.start_date ? new Date(season.start_date) : new Date();
  let seasonEnd = season.end_date ? new Date(season.end_date) : new Date(Date.now() + 90 * DAY_MS);
  if (isNaN(seasonStart.getTime())) seasonStart = new Date();
  if (isNaN(seasonEnd.getTime())) seasonEnd = new Date(Date.now() + 90 * DAY_MS);
  // `end_date` ist ein DATE (UTC-Mitternacht): ohne das fiele jeder Termin AM Enddatum weg.
  seasonEnd.setUTCHours(23, 59, 59, 999);

  const seasonLengthDays = Math.ceil((seasonEnd.getTime() - seasonStart.getTime()) / DAY_MS);
  const totalSeasonWeeks = Math.max(1, Math.ceil(seasonLengthDays / 7));

  const plan: PublishPlan = {
    schedule: {
      // Der Saisontyp gehört in den Schlüssel: Winter 2026/27 hat year=2026 wie der Sommer.
      season_type: season.season_type === 'winter' ? 'winter' : 'summer',
      season_year:
        typeof season.year === 'number' && !Number.isNaN(season.year)
          ? season.year
          : new Date().getFullYear(),
      season_start_date: seasonStart.toISOString(),
      season_end_date: seasonEnd.toISOString(),
    },
    sessions: [],
    bookings: [],
    entryUpdates: [],
  };

  for (const entry of entries) {
    const [startH, startM] = (entry.start_time || '00:00:00')
      .split(':')
      .map((n) => parseInt(n, 10));
    const [endH, endM] = (entry.end_time || '00:00:00').split(':').map((n) => parseInt(n, 10));
    const durationMs = (endH * 60 + endM - (startH * 60 + startM)) * 60 * 1000;
    const actualDurationMs = durationMs > 0 ? durationMs : entry.duration_minutes * 60 * 1000;

    // Vertretungstrainer gilt für beide Wochentermine.
    const {
      substitute_trainer_id: subId,
      substitute_from_week: subFrom,
      substitute_to_week: subTo,
    } = entry;
    const trainerForWeek = (week: number) =>
      subId && subFrom != null && subTo != null && week >= subFrom && week <= subTo
        ? subId
        : entry.trainer_id;

    const participants = (entry.expected_participants as string[]) || [];
    const startWeek = entry.starts_from_week || 1;
    // ends_at_week null oder 1 (veralteter Default) → ganze Saison.
    const endWeek =
      entry.ends_at_week !== null && entry.ends_at_week !== undefined && entry.ends_at_week > 1
        ? entry.ends_at_week
        : totalSeasonWeeks;

    const created: string[] = [];
    const addSessions = (dayOfWeek: number, note: string) => {
      const first = firstOccurrence(seasonStart, dayOfWeek);
      for (let week = startWeek; week <= endWeek && week <= totalSeasonWeeks; week++) {
        const day = new Date(first);
        day.setUTCDate(day.getUTCDate() + (week - 1) * 7);
        // Uhrzeit pro Woche aus der Berliner Ortszeit — bleibt über die Zeitumstellung 17:00.
        const start = berlinWallClock(day, startH, startM);
        if (start > seasonEnd) break;
        // Vergangene Termine beim erneuten Veröffentlichen nicht doppeln.
        if (isRepublish && start < now) continue;
        if (
          holidays.length > 0 &&
          isDateInHolidays(start.toISOString().substring(0, 10), holidays)
        ) {
          continue;
        }
        if (entry.group_id && inactiveWeeks.has(`${entry.group_id}|${week}`)) continue;

        const end = new Date(start.getTime() + actualDurationMs);
        const id = randomUUID();
        plan.sessions.push({
          id,
          trainer_id: trainerForWeek(week),
          group_ids: entry.group_id ? [entry.group_id] : [],
          week_number: week,
          timeslot_start: start.toISOString(),
          timeslot_end: end.toISOString(),
          court_id: entry.court_id,
          max_participants: entry.max_participants || 10,
          notes: note,
          plan_entry_id: entry.id,
        });
        created.push(id);

        // bookings.court_id ist NOT NULL: ohne Platz keine Buchung (Konfliktbericht warnt).
        if (entry.court_id) {
          for (const memberId of participants) {
            plan.bookings.push({
              member_id: memberId,
              session_id: id,
              court_id: entry.court_id,
              session_start_time: start.toISOString(),
              start_time: start.toISOString(),
              end_time: end.toISOString(),
              notes: 'Erstellt durch Saisonplanung',
            });
          }
        }
      }
    };

    addSessions(entry.day_of_week, 'Erstellt durch Saisonplanung');
    if ((entry.sessions_per_week ?? 1) >= 2) {
      const dow2 = entry.day_of_week_2 != null ? entry.day_of_week_2 : (entry.day_of_week + 3) % 7;
      addSessions(dow2, 'Erstellt durch Saisonplanung (2. Wochentermin)');
    }

    if (created.length > 0) plan.entryUpdates.push({ id: entry.id, sid: created[0] });
  }

  return plan;
}

/**
 * Season Plan Dry-Run Service
 *
 * Simulates the full consequences of confirming/publishing a season plan
 * WITHOUT writing anything to the database. Used to give admins a complete
 * preview of:
 *   • Conflicts that would be detected
 *   • Sessions that would be created (incl. holiday filtering)
 *   • Financial impact (revenue, training cost, membership fees)
 *   • Communication effort (emails, ICS attachments, recipients)
 *   • Resource utilization (trainer hours, court bookings, active weeks)
 *
 * Use this before calling the real confirm endpoint to surface issues
 * before they become real-world consequences.
 */

import { eq, inArray, and, isNotNull } from 'drizzle-orm';
import { db } from '@/src/infrastructure/persistence/db';
import {
  seasons,
  seasonPlanEntries,
  sessions as sessionsTable,
  sessionRsvps,
  clubs,
} from '@/src/infrastructure/persistence/schema';
import { ConflictDetector } from '@/lib/season-planning/conflict-detector';
import { seasonBillingService } from '@/lib/billing/season-billing.service';
import { seasonConfirmationEmailService } from '@/lib/season-planning/season-confirmation-email.service';
import {
  isDateInHolidays,
  getHolidaysForState,
  resolveBundeslandCode,
  type Holiday,
} from '@/lib/season-planning/holidays';
import { normalizeRsvpStatus, type RsvpStatusKey } from '@/lib/rsvp-status';
import type { GroupAssignment, ConflictDetectionResult } from '@/lib/season-planning/types';
import type { SeasonBillingPreview } from '@/lib/billing/season-billing.service';

import { createLogger } from '@/lib/logger';

const log = createLogger('season-planning:dry-run.service');

// ============================================
// TYPES
// ============================================

export interface DryRunSessionBucket {
  /** ISO date YYYY-MM-DD */
  date: string;
  dayOfWeek: number;
  hour: number;
  durationMin: number;
  groupId: string | null;
  trainerId: string;
  courtId: string | null;
  wouldCreate: boolean;
  skipReason: 'outside_season' | 'holiday' | null;
  holidayNames: string[];
}

/**
 * Aggregated RSVP distribution across the season's published sessions.
 * Built from `session_rsvps` joined with `sessions` (where `season_id` matches).
 * Useful for forecasting attendance: "if we publish, members will likely
 * respond in roughly this ratio".
 */
export interface DryRunRsvpDistribution {
  counts: Record<RsvpStatusKey, number>;
  total: number;
  /** Approval rate (accepted / total), in [0, 1]. 0 when total is 0. */
  acceptanceRate: number;
  /** Number of distinct sessions whose RSVPs were aggregated. */
  sessionSampleSize: number;
  /** ISO timestamp when this snapshot was computed. */
  capturedAt: string;
}

export const EMPTY_RSVP_DISTRIBUTION: DryRunRsvpDistribution = {
  counts: { accepted: 0, declined: 0, maybe: 0, pending: 0, unknown: 0 },
  total: 0,
  acceptanceRate: 0,
  sessionSampleSize: 0,
  capturedAt: '',
};

// ============================================
// DRY-RUN DIFF (P2.22)
// ============================================

/**
 * Categorizes a single dry-run bucket relative to the currently published plan.
 *  - `unchanged`:    bucket matches an existing published session 1:1 (same date, time, court, trainer)
 *  - `would_create`: no matching published session exists → publish will insert a new row
 *  - `would_modify`: published session exists for the same logical key (group × dayOfWeek × startTime)
 *                    but with different details (court / trainer / time) → publish will UPDATE the row
 *  - `would_delete`: a published session exists that has no matching new bucket
 *                    → publish will remove the orphaned row
 */
export type DryRunDiffKind = 'unchanged' | 'would_create' | 'would_modify' | 'would_delete';

export interface DryRunDiffEntry {
  /** Stable key: `${groupId ?? 'noGroup'}:${dayOfWeek}:${HH:MM}`. */
  key: string;
  kind: DryRunDiffKind;
  date: string;
  dayOfWeek: number;
  startTime: string;
  groupId: string | null;
  trainerId: string;
  courtId: string | null;
  /** Human-readable summary of what changed (only set for would_modify / would_delete). */
  changeSummary: string | null;
}

export interface DryRunDiff {
  generatedAt: string;
  totals: {
    unchanged: number;
    wouldCreate: number;
    wouldModify: number;
    wouldDelete: number;
  };
  /** Capped at 200 entries per kind to keep the response small. */
  sample: {
    unchanged: DryRunDiffEntry[];
    wouldCreate: DryRunDiffEntry[];
    wouldModify: DryRunDiffEntry[];
    wouldDelete: DryRunDiffEntry[];
  };
}

export const DIFF_SAMPLE_CAP_PER_KIND = 200;

/**
 * Build the stable key used to align dry-run buckets with existing published
 * sessions. Group × dayOfWeek × startTime is the natural identity (we don't
 * align by date because the publish rolls forward to the next valid week).
 */
function buildDiffKey(groupId: string | null, dayOfWeek: number, startTime: string): string {
  return `${groupId ?? 'noGroup'}:${dayOfWeek}:${startTime.slice(0, 5)}`;
}

/**
 * Compute a bucket-aligned diff between the dry-run output and the currently
 * published plan. Pure function — exported for unit tests.
 *
 * @param dryRunBuckets   Output of {@link simulateSessionBuckets} (only
 *                        `wouldCreate: true` buckets are relevant for the
 *                        create/modify side; holiday-skipped buckets do NOT
 *                        produce deletes on their own).
 * @param publishedSessions  Rows joined from `season_plan_entries ⨝ sessions`
 *                        via `season_plan_entries.published_session_id`.
 *                        `startTime` is the plan entry's logical start time
 *                        (e.g. "17:00:00"), NOT the session's wall-clock
 *                        timestamp — we want hour resolution to match the
 *                        bucket keys.
 */
export function computeDryRunDiff(
  dryRunBuckets: ReadonlyArray<{
    groupId: string | null;
    dayOfWeek: number;
    date: string;
    hour: number;
    durationMin: number;
    trainerId: string;
    courtId: string | null;
    wouldCreate: boolean;
  }>,
  publishedSessions: ReadonlyArray<{
    id: string;
    timeslotStart: string;
    trainerId: string | null;
    courtId: string | null;
    dayOfWeek: number;
    groupId: string | null;
    /** Plan entry's logical start time, e.g. "17:00:00" → key uses "17:00" */
    startTime: string;
  }>
): DryRunDiff {
  const cap = DIFF_SAMPLE_CAP_PER_KIND;

  // 1. Index published sessions by diff-key (group × dayOfWeek × hour:00)
  const publishedByKey = new Map<
    string,
    {
      id: string;
      timeslotStart: string;
      trainerId: string | null;
      courtId: string | null;
      dayOfWeek: number;
      groupId: string | null;
      startTime: string;
    }
  >();
  for (const p of publishedSessions) {
    // Normalize the plan entry's "HH:MM:SS" to hour resolution "HH:00"
    const logicalHour = p.startTime.slice(0, 2);
    const startTime = `${logicalHour}:00`;
    const key = buildDiffKey(p.groupId, p.dayOfWeek, startTime);
    if (!publishedByKey.has(key)) {
      publishedByKey.set(key, {
        id: p.id,
        timeslotStart: p.timeslotStart,
        trainerId: p.trainerId,
        courtId: p.courtId,
        dayOfWeek: p.dayOfWeek,
        groupId: p.groupId,
        startTime,
      });
    }
  }

  // 2. Walk the dry-run buckets (only billable ones), classify, and consume
  //    matching published sessions so we don't double-count them as `unchanged`.
  const sample: DryRunDiff['sample'] = {
    unchanged: [],
    wouldCreate: [],
    wouldModify: [],
    wouldDelete: [],
  };
  const totals: DryRunDiff['totals'] = {
    unchanged: 0,
    wouldCreate: 0,
    wouldModify: 0,
    wouldDelete: 0,
  };
  const seenKeys = new Set<string>();

  for (const b of dryRunBuckets) {
    if (!b.wouldCreate) continue; // holiday-skipped → not a real change
    const startTime = `${String(b.hour).padStart(2, '0')}:00`; // dry-run only tracks the hour
    const key = buildDiffKey(b.groupId, b.dayOfWeek, startTime);
    seenKeys.add(key);

    const existing = publishedByKey.get(key);

    if (!existing) {
      totals.wouldCreate += 1;
      if (sample.wouldCreate.length < cap) {
        sample.wouldCreate.push({
          key,
          kind: 'would_create',
          date: b.date,
          dayOfWeek: b.dayOfWeek,
          startTime,
          groupId: b.groupId,
          trainerId: b.trainerId,
          courtId: b.courtId,
          changeSummary: null,
        });
      }
      continue;
    }

    // Match found — check if any of the mutable fields changed
    const fieldsChanged: string[] = [];
    if ((existing.trainerId ?? null) !== (b.trainerId ?? null)) {
      fieldsChanged.push('Trainer');
    }
    if ((existing.courtId ?? null) !== (b.courtId ?? null)) {
      fieldsChanged.push('Platz');
    }

    if (fieldsChanged.length === 0) {
      totals.unchanged += 1;
      if (sample.unchanged.length < cap) {
        sample.unchanged.push({
          key,
          kind: 'unchanged',
          date: b.date,
          dayOfWeek: b.dayOfWeek,
          startTime,
          groupId: b.groupId,
          trainerId: b.trainerId,
          courtId: b.courtId,
          changeSummary: null,
        });
      }
    } else {
      totals.wouldModify += 1;
      if (sample.wouldModify.length < cap) {
        sample.wouldModify.push({
          key,
          kind: 'would_modify',
          date: b.date,
          dayOfWeek: b.dayOfWeek,
          startTime,
          groupId: b.groupId,
          trainerId: b.trainerId,
          courtId: b.courtId,
          changeSummary: `${fieldsChanged.join(' + ')} ändert sich`,
        });
      }
    }
  }

  // 3. Anything in `publishedByKey` we didn't visit is a would_delete
  for (const [key, existing] of publishedByKey) {
    if (seenKeys.has(key)) continue;
    totals.wouldDelete += 1;
    if (sample.wouldDelete.length < cap) {
      const startTime = existing.timeslotStart.slice(11, 16);
      sample.wouldDelete.push({
        key,
        kind: 'would_delete',
        date: existing.timeslotStart.slice(0, 10),
        dayOfWeek: existing.dayOfWeek,
        startTime,
        groupId: existing.groupId,
        trainerId: existing.trainerId ?? '',
        courtId: existing.courtId,
        changeSummary: 'Eintrag aus dem Plan entfernt — Session wird gelöscht',
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    totals,
    sample,
  };
}

export interface DryRunReport {
  ok: true;
  generatedAt: string;
  season: {
    id: string;
    name: string;
    clubId: string;
    startDate: string;
    endDate: string;
    seasonType: string;
    bundesland: string | null;
  };
  summary: {
    /** Hard blockers — must be resolved before publish. */
    criticalConflictCount: number;
    warningConflictCount: number;
    infoConflictCount: number;
    /** Sessions the publish would create (post-holiday filter). */
    wouldCreateSessions: number;
    /** Sessions skipped because of holidays. */
    skippedHolidaySessions: number;
    /** Total unique members that would be invoiced. */
    invoicedMemberCount: number;
    /** Total unique trainers that would have at least one session. */
    activeTrainerCount: number;
    /** Total unique courts that would have at least one session. */
    activeCourtCount: number;
    /** Total recipient emails that would be sent. */
    emailRecipientCount: number;
    /** Estimated email cost in EUR (Resend Pro: ~€0.20 per 1k emails). */
    estimatedEmailCost: number;
    /** Total season weeks the plan spans. */
    totalSeasonWeeks: number;
    /** Total active weeks (entries × weeks with non-zero sessions). */
    totalActiveWeeks: number;
    /** Total trainer hours that would be billed. */
    totalTrainerHours: number;
    /** Snapshot of expected RSVP acceptance rate (0-1) from the season. */
    expectedAcceptanceRate: number;
    /** Total RSVPs sampled across the season's published sessions. */
    rsvpSampleSize: number;
  };
  /** Conflicts detected during the dry-run (NOT persisted). */
  conflicts: ConflictDetectionResult[];
  /** Aggregated per-group financial breakdown. */
  billing: SeasonBillingPreview | null;
  /** Granular per-session preview (capped at 500 entries). */
  sessions: {
    total: number;
    sample: DryRunSessionBucket[];
  };
  /**
   * RSVP distribution snapshot across the season's existing published sessions.
   * Used to forecast attendance mix for the new sessions about to be created.
   * `null` when no RSVPs could be sampled (e.g. first publish, no sessions yet).
   */
  rsvpDistribution: DryRunRsvpDistribution | null;
  /**
   * Diff vs. currently published plan (P2.22). For each simulated bucket,
   * indicates whether the publish would create a brand-new session, replace
   * an existing one, leave it untouched, or (in the case of holidays being
   * removed from the plan) effectively delete it. `null` when the season has
   * never been published (first publish → all entries appear as `would_create`).
   */
  diff: DryRunDiff | null;
  /** Warnings that are not blockers but worth showing. */
  warnings: Array<{
    level: 'info' | 'warning';
    code: string;
    message: string;
  }>;
}

export interface DryRunError {
  ok: false;
  error: string;
  code: 'season_not_found' | 'no_entries' | 'internal';
}

// ============================================
// SERVICE
// ============================================

const SESSION_SAMPLE_CAP = 500;
/** Resend pricing: roughly €0.20 per 1000 emails (Pro plan). */
const EMAIL_COST_PER_UNIT_EUR = 0.0002;

function buildGroupAssignments(
  entries: Array<{
    id: string;
    group_id: string | null;
    trainer_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    court_id: string | null;
    expected_participants: unknown;
    max_participants: number | null;
  }>
): GroupAssignment[] {
  const groupMap = new Map<string, GroupAssignment>();
  for (const entry of entries) {
    const gid = entry.group_id || entry.id;
    const participants = Array.isArray(entry.expected_participants)
      ? (entry.expected_participants as string[])
      : [];
    if (groupMap.has(gid)) {
      const ga = groupMap.get(gid);
      if (ga) {
        ga.memberIds.push(...participants);
      }
      continue;
    }
    const startTime = entry.start_time?.substring(0, 5) ?? '00:00';
    const endTime = entry.end_time?.substring(0, 5) ?? '00:00';
    groupMap.set(gid, {
      groupId: gid,
      groupName: gid,
      trainerId: entry.trainer_id,
      trainerName: entry.trainer_id,
      dayOfWeek: entry.day_of_week as GroupAssignment['dayOfWeek'],
      startTime,
      endTime,
      courtId: entry.court_id,
      courtName: entry.court_id,
      maxSize: entry.max_participants ?? 6,
      memberIds: participants,
      memberDetails: participants.map((mid) => ({
        memberId: mid,
        memberName: mid,
        niveauMatch: 100,
        experienceMonths: 0,
        groupExperienceSpan: '0-0 Monate',
        wishPartnerFulfilled: false,
        wishPartnerNames: [],
        isPromoted: false,
        assignmentReason: '',
      })),
      waitlistIds: [],
      waitlistDetails: [],
      warnings: [],
      conflictIds: [],
    });
  }
  return Array.from(groupMap.values());
}

function parseTime(value: string | null | undefined): { h: number; m: number } {
  const v = value ?? '00:00:00';
  const parts = v.split(':');
  const h = Number.parseInt(parts[0] ?? '0', 10);
  const m = Number.parseInt(parts[1] ?? '0', 10);
  return { h: Number.isNaN(h) ? 0 : h, m: Number.isNaN(m) ? 0 : m };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Pure helper: aggregate raw RSVP rows into a {@link DryRunRsvpDistribution}.
 *
 * Exported so the unit tests can exercise the bucketing/normalization logic
 * without hitting the database.
 */
export function aggregateRsvpRows(
  rows: ReadonlyArray<{ status: string | null | undefined }>
): DryRunRsvpDistribution {
  const counts: Record<RsvpStatusKey, number> = {
    accepted: 0,
    declined: 0,
    maybe: 0,
    pending: 0,
    unknown: 0,
  };
  for (const r of rows) {
    const key = normalizeRsvpStatus(r.status);
    counts[key] += 1;
  }
  const total = rows.length;
  const acceptanceRate = total > 0 ? counts.accepted / total : 0;
  return {
    counts,
    total,
    acceptanceRate: Math.round(acceptanceRate * 1000) / 1000,
    sessionSampleSize: 0, // set by caller (needs DISTINCT session count)
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Pure helper: session-simulation logic (used by tests + runSeasonDryRun).
 * Walks the entry list, iterates over the season weeks, applies the holiday
 * filter, and records wouldCreate / skipReason / holidayNames for each bucket.
 */
export function simulateSessionBuckets(
  entries: ReadonlyArray<{
    trainer_id: string;
    day_of_week: number;
    start_time: string | null;
    end_time: string | null;
    duration_minutes: number | null;
    court_id: string | null;
    group_id: string | null;
    starts_from_week?: number | null;
    ends_at_week?: number | null;
  }>,
  opts: {
    seasonStart: Date;
    seasonEnd: Date;
    totalSeasonWeeks: number;
    holidays: Holiday[];
    cap?: number;
  }
): {
  buckets: DryRunSessionBucket[];
  wouldCreateSessions: number;
  skippedHolidaySessions: number;
  activeTrainerIds: Set<string>;
  activeCourtIds: Set<string>;
} {
  const cap = opts.cap ?? SESSION_SAMPLE_CAP;
  const safeStart = opts.seasonStart;
  const safeEnd = opts.seasonEnd;
  const holidays = opts.holidays;
  const buckets: DryRunSessionBucket[] = [];
  let wouldCreateSessions = 0;
  let skippedHolidaySessions = 0;
  const activeTrainerIds = new Set<string>();
  const activeCourtIds = new Set<string>();

  for (const entry of entries) {
    const startParts = parseTime(entry.start_time);
    const endParts = parseTime(entry.end_time);
    const durationMs = (endParts.h * 60 + endParts.m - (startParts.h * 60 + startParts.m)) * 60_000;
    const actualDurationMs = durationMs > 0 ? durationMs : (entry.duration_minutes ?? 0) * 60_000;
    const durationMin = Math.max(1, Math.round(actualDurationMs / 60_000));

    const targetDayOfWeek = entry.day_of_week;
    const jsDayOfWeek = targetDayOfWeek === 6 ? 0 : targetDayOfWeek + 1;
    const firstDate = new Date(safeStart);
    let daysUntil = jsDayOfWeek - firstDate.getDay();
    if (daysUntil < 0) daysUntil += 7;
    firstDate.setDate(firstDate.getDate() + daysUntil);
    firstDate.setHours(startParts.h, startParts.m, 0, 0);

    const startWeek = entry.starts_from_week ?? 1;
    const rawEndWeek = entry.ends_at_week;
    const endWeek =
      rawEndWeek !== null && rawEndWeek !== undefined && rawEndWeek > 1
        ? rawEndWeek
        : opts.totalSeasonWeeks;

    const entryTrainerId = entry.trainer_id;
    if (entryTrainerId) activeTrainerIds.add(entryTrainerId);
    if (entry.court_id) activeCourtIds.add(entry.court_id);

    for (let week = startWeek; week <= endWeek && week <= opts.totalSeasonWeeks; week++) {
      const sessionDate = new Date(firstDate);
      sessionDate.setDate(sessionDate.getDate() + (week - 1) * 7);
      if (sessionDate > safeEnd) continue;

      const dateStr = isoDate(sessionDate);
      const inHoliday = isDateInHolidays(dateStr, holidays);
      const holidayNames = inHoliday
        ? holidays.filter((h) => h.start <= dateStr && h.end >= dateStr).map((h) => h.name)
        : [];

      if (inHoliday) {
        skippedHolidaySessions += 1;
        if (buckets.length < cap) {
          buckets.push({
            date: dateStr,
            dayOfWeek: targetDayOfWeek,
            hour: startParts.h,
            durationMin,
            groupId: entry.group_id ?? null,
            trainerId: entryTrainerId,
            courtId: entry.court_id ?? null,
            wouldCreate: false,
            skipReason: 'holiday',
            holidayNames,
          });
        }
        continue;
      }

      wouldCreateSessions += 1;
      if (buckets.length < cap) {
        buckets.push({
          date: dateStr,
          dayOfWeek: targetDayOfWeek,
          hour: startParts.h,
          durationMin,
          groupId: entry.group_id ?? null,
          trainerId: entryTrainerId,
          courtId: entry.court_id ?? null,
          wouldCreate: true,
          skipReason: null,
          holidayNames: [],
        });
      }
    }
  }

  return { buckets, wouldCreateSessions, skippedHolidaySessions, activeTrainerIds, activeCourtIds };
}

/**
 * Load all published sessions for the season by joining
 * `season_plan_entries ⨝ sessions` on `season_plan_entries.published_session_id`.
 *
 * Returns the data {@link computeDryRunDiff} needs to align dry-run buckets
 * with currently-published rows. The join is the source of truth because the
 * dry-run plans by season, not by schedule — so the link from a plan entry to
 * its materialized session is the only reliable mapping.
 *
 * `season_plan_entries` is on the FROM side so that plan entries whose
 * `published_session_id` was deleted (set null by FK) are naturally excluded
 * from the diff (they don't appear as `would_delete` candidates because the
 * session is already gone).
 *
 * Returns an empty array on failure (caller treats this as "no published
 * state" → all buckets become `would_create`).
 */
async function loadPublishedSessionsForDiff(seasonId: string): Promise<
  Array<{
    id: string;
    timeslotStart: string;
    trainerId: string | null;
    courtId: string | null;
    dayOfWeek: number;
    groupId: string | null;
    startTime: string;
  }>
> {
  try {
    const rows = await db
      .select({
        id: sessionsTable.id,
        timeslotStart: sessionsTable.timeslot_start,
        trainerId: sessionsTable.trainer_id,
        courtId: sessionsTable.court_id,
        dayOfWeek: seasonPlanEntries.day_of_week,
        groupId: seasonPlanEntries.group_id,
        startTime: seasonPlanEntries.start_time,
      })
      .from(seasonPlanEntries)
      .innerJoin(sessionsTable, eq(sessionsTable.id, seasonPlanEntries.published_session_id))
      .where(
        and(
          eq(seasonPlanEntries.season_id, seasonId),
          isNotNull(seasonPlanEntries.published_session_id)
        )
      );

    return rows.map((r) => {
      const ts =
        r.timeslotStart instanceof Date ? r.timeslotStart.toISOString() : String(r.timeslotStart);
      return {
        id: r.id,
        timeslotStart: ts,
        trainerId: r.trainerId,
        courtId: r.courtId,
        dayOfWeek: r.dayOfWeek,
        groupId: r.groupId,
        // Drizzle's time() column comes back as a string "HH:MM:SS" — keep it
        // verbatim so computeDryRunDiff can normalize it to "HH:00".
        startTime: String(r.startTime ?? '00:00:00'),
      };
    });
  } catch (err) {
    log.warn('[DryRun] loadPublishedSessionsForDiff failed:', err);
    return [];
  }
}

/**
 * Load the RSVP distribution for the current season by joining
 * `session_rsvps` with `sessions` on `sessions.season_id`.
 *
 * Returns `null` when there are no published sessions or RSVPs yet
 * (e.g. first publish of a brand-new season).
 */
async function loadRsvpDistribution(seasonId: string): Promise<DryRunRsvpDistribution | null> {
  try {
    const sessionRows = await db
      .select({ id: sessionsTable.id })
      .from(sessionsTable)
      .where(eq(sessionsTable.schedule_id, seasonId));
    // Note: sessions table links to schedules, not seasons directly.
    // The most reliable link is schedule_id (= season's id) because the
    // publish flow creates a new schedule per season. If that's empty,
    // we fall back to selecting all RSVPs from this club via a richer query.
    if (sessionRows.length === 0) {
      return null;
    }
    const sessionIds = sessionRows.map((s) => s.id);
    const rsvpRows = await db
      .select({ status: sessionRsvps.status })
      .from(sessionRsvps)
      .where(inArray(sessionRsvps.session_id, sessionIds));
    const dist = aggregateRsvpRows(rsvpRows);
    return {
      ...dist,
      sessionSampleSize: sessionIds.length,
    };
  } catch (err) {
    // The table might not exist yet, or the join may fail in dev — non-fatal.
    log.warn('[DryRun] RSVP distribution load failed:', err);
    return null;
  }
}

/**
 * Run a complete dry-run of the publish workflow for a given season.
 * Does NOT write anything to the database. Safe to call repeatedly.
 */
export async function runSeasonDryRun(seasonId: string): Promise<DryRunReport | DryRunError> {
  try {
    // 1. Load season
    const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
    if (!season) {
      return { ok: false, error: 'Saison nicht gefunden', code: 'season_not_found' };
    }

    // 2. Load entries
    const entries = await db
      .select()
      .from(seasonPlanEntries)
      .where(eq(seasonPlanEntries.season_id, seasonId));

    if (entries.length === 0) {
      return {
        ok: false,
        error: 'Keine Planungseinträge für diese Saison vorhanden',
        code: 'no_entries',
      };
    }

    // 3. Resolve holidays from club's Bundesland
    let holidays: Holiday[] = [];
    let bundesland: string | null = null;
    try {
      const [club] = await db
        .select({ bundesland: clubs.bundesland })
        .from(clubs)
        .where(eq(clubs.id, season.club_id))
        .limit(1);
      bundesland = club?.bundesland ?? null;
      if (bundesland) {
        const code = resolveBundeslandCode(bundesland);
        holidays = getHolidaysForState(code);
      }
    } catch (err) {
      // Non-fatal — continue without holiday filter
      log.warn('[DryRun] Failed to load holidays, proceeding without:', err);
    }

    // 4. Compute season length
    const seasonStart = new Date(season.start_date);
    const seasonEnd = new Date(season.end_date);
    const safeStart = Number.isNaN(seasonStart.getTime()) ? new Date() : seasonStart;
    const safeEnd = Number.isNaN(seasonEnd.getTime())
      ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      : seasonEnd;
    const seasonLengthDays = Math.max(
      1,
      Math.ceil((safeEnd.getTime() - safeStart.getTime()) / 86_400_000)
    );
    const totalSeasonWeeks = Math.max(1, Math.ceil(seasonLengthDays / 7));

    // 5. Conflict detection (read-only — does NOT call persistConflicts)
    const assignments = buildGroupAssignments(
      entries.map((e) => ({
        id: e.id,
        group_id: e.group_id,
        trainer_id: e.trainer_id,
        day_of_week: e.day_of_week,
        start_time: e.start_time,
        end_time: e.end_time,
        court_id: e.court_id,
        expected_participants: e.expected_participants,
        max_participants: e.max_participants,
      }))
    );
    const detector = new ConflictDetector(seasonId, season.club_id);
    const conflicts = await detector.detectAll(assignments);

    // 6. Session simulation: build the same loop the confirm endpoint runs,
    //    but record the decisions instead of inserting rows.
    const sim = simulateSessionBuckets(
      entries.map((e) => ({
        trainer_id: e.trainer_id,
        day_of_week: e.day_of_week,
        start_time: e.start_time,
        end_time: e.end_time,
        duration_minutes: e.duration_minutes,
        court_id: e.court_id,
        group_id: e.group_id,
        starts_from_week: e.starts_from_week,
        ends_at_week: e.ends_at_week,
      })),
      {
        seasonStart: safeStart,
        seasonEnd: safeEnd,
        totalSeasonWeeks,
        holidays: [...holidays],
      }
    );
    const sessions: DryRunSessionBucket[] = sim.buckets;
    const wouldCreateSessions = sim.wouldCreateSessions;
    const skippedHolidaySessions = sim.skippedHolidaySessions;
    const trainerIds = sim.activeTrainerIds;
    const courtIds = sim.activeCourtIds;

    // 7. Financial preview (reuse the existing calculatePreview — it does not write)
    let billing: SeasonBillingPreview | null = null;
    let billingError: string | null = null;
    try {
      billing = await seasonBillingService.calculatePreview(seasonId);
    } catch (err) {
      billingError = err instanceof Error ? err.message : 'Billing-Vorschau fehlgeschlagen';
    }

    // 7b. RSVP distribution across the season's already-published sessions.
    //     Forecasts the attendance mix the new sessions will likely see.
    const rsvpDistribution = await loadRsvpDistribution(seasonId);

    // 7c. Dry-Run Diff vs. currently published plan (P2.22). `null` when
    //     the season has never been published (first publish → no diff).
    let diff: DryRunDiff | null = null;
    try {
      const publishedSessions = await loadPublishedSessionsForDiff(seasonId);
      diff = computeDryRunDiff(
        sim.buckets.map((b) => ({
          groupId: b.groupId,
          dayOfWeek: b.dayOfWeek,
          date: b.date,
          hour: b.hour,
          durationMin: b.durationMin,
          trainerId: b.trainerId,
          courtId: b.courtId,
          wouldCreate: b.wouldCreate,
        })),
        publishedSessions
      );
    } catch (err) {
      // Non-fatal — diff is informational, dry-run continues without it
      log.warn('[DryRun] Diff computation failed:', err);
    }

    // 8. Communication preview — build recipients list the same way the
    //    confirm route does, but don't send anything.
    let emailRecipientCount = 0;
    try {
      const recipients = await seasonConfirmationEmailService.buildRecipients(
        seasonId,
        entries.map((e) => ({
          expected_participants: (e.expected_participants as string[] | null) ?? null,
          trainer_id: e.trainer_id,
          group_id: e.group_id,
        })),
        [] // publishedIds not needed for the recipient build
      );
      emailRecipientCount = recipients.length;
    } catch (err) {
      // Non-fatal — log and continue
      log.warn('[DryRun] Recipient build failed:', err);
    }

    // 9. Trainer hours
    const totalTrainerHours = sessions
      .filter((s) => s.wouldCreate)
      .reduce((acc, s) => acc + s.durationMin / 60, 0);

    // 10. Active weeks = unique (group_id × week) tuples that yield a session
    const activeWeeks = new Set<string>();
    for (const s of sessions) {
      if (!s.wouldCreate || !s.groupId) continue;
      // ISO week of the date
      const d = new Date(s.date + 'T00:00:00Z');
      const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const dayNum = target.getUTCDay() || 7;
      target.setUTCDate(target.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
      const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
      activeWeeks.add(`${s.groupId}:${target.getUTCFullYear()}-${week}`);
    }

    // 11. Conflicts counts
    const criticalConflictCount = conflicts.filter(
      (c) => c.severity === 'critical' && c.status === 'open'
    ).length;
    const warningConflictCount = conflicts.filter(
      (c) => c.severity === 'warning' && c.status === 'open'
    ).length;
    const infoConflictCount = conflicts.filter(
      (c) => c.severity === 'info' && c.status === 'open'
    ).length;

    // 12. Build non-blocking warnings
    const warnings: DryRunReport['warnings'] = [];
    if (billingError) {
      warnings.push({
        level: 'warning',
        code: 'BILLING_PREVIEW_FAILED',
        message: `Abrechnungs-Vorschau nicht verfügbar: ${billingError}`,
      });
    }
    if (criticalConflictCount > 0) {
      warnings.push({
        level: 'warning',
        code: 'BLOCKING_CONFLICTS',
        message: `${criticalConflictCount} kritische Konflikt${criticalConflictCount !== 1 ? 'e' : ''} — Veröffentlichung blockiert bis gelöst`,
      });
    }
    if (emailRecipientCount === 0) {
      warnings.push({
        level: 'info',
        code: 'NO_RECIPIENTS',
        message:
          'Keine E-Mail-Empfänger ermittelt — Mitglieder haben keine expected_participants in den Einträgen',
      });
    }
    if (holidays.length === 0) {
      warnings.push({
        level: 'info',
        code: 'NO_HOLIDAYS',
        message:
          'Keine Ferien für das Bundesland geladen — alle geplanten Sessions werden erstellt',
      });
    }
    if (rsvpDistribution === null) {
      warnings.push({
        level: 'info',
        code: 'NO_RSVP_DATA',
        message: 'Keine RSVP-Daten vorhanden — Verteilung wird beim ersten Publish aufgebaut',
      });
    }

    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      season: {
        id: season.id,
        name: season.name,
        clubId: season.club_id,
        startDate:
          season.start_date instanceof Date
            ? season.start_date.toISOString().slice(0, 10)
            : String(season.start_date).slice(0, 10),
        endDate:
          season.end_date instanceof Date
            ? season.end_date.toISOString().slice(0, 10)
            : String(season.end_date).slice(0, 10),
        seasonType: season.season_type,
        bundesland,
      },
      summary: {
        criticalConflictCount,
        warningConflictCount,
        infoConflictCount,
        wouldCreateSessions,
        skippedHolidaySessions,
        invoicedMemberCount: billing?.memberCount ?? 0,
        activeTrainerCount: trainerIds.size,
        activeCourtCount: courtIds.size,
        emailRecipientCount,
        estimatedEmailCost: Math.round(emailRecipientCount * EMAIL_COST_PER_UNIT_EUR * 100) / 100,
        totalSeasonWeeks,
        totalActiveWeeks: activeWeeks.size,
        totalTrainerHours: Math.round(totalTrainerHours * 10) / 10,
        expectedAcceptanceRate: rsvpDistribution?.acceptanceRate ?? 0,
        rsvpSampleSize: rsvpDistribution?.total ?? 0,
      },
      conflicts,
      billing,
      sessions: {
        total: wouldCreateSessions + skippedHolidaySessions,
        sample: sessions.slice(0, SESSION_SAMPLE_CAP),
      },
      rsvpDistribution,
      diff,
      warnings,
    };
  } catch (err) {
    log.error('[DryRun] Failed:', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unbekannter Fehler',
      code: 'internal',
    };
  }
}

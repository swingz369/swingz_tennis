import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import {
  BUNDESLAND_NAMES,
  getMonday,
  getWeeks,
  resolveBundeslandCode,
  type Holiday,
  type WeekInfo,
} from './holidays';
import { loadHolidaysForState } from './holidays.server';

export interface CalendarGroup {
  id: string;
  name: string;
  age_group: string | null;
  level: string | null;
  color: string | null;
}

export interface CalendarWeek extends WeekInfo {
  weekNumber: number;
  /** ISO calendar week (1-53) of the Monday. */
  isoWeek: number;
  /** Month label (de-DE) for header grouping. */
  monthLabel: string;
  /** First day of the month this week belongs to. */
  monthKey: string;
  /** Short date range label, e.g. "01.09–07.09". */
  rangeLabel: string;
}

export interface GroupWeekStatus {
  groupId: string;
  weekMonday: string;
  isActive: boolean;
  reason: string | null;
}

export interface SeasonCalendarData {
  season: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    season_type: string;
    club_id: string;
  };
  groups: CalendarGroup[];
  weeks: CalendarWeek[];
  /** Map: `${groupId}:${weekMonday}` → status. */
  statusMap: Record<string, GroupWeekStatus>;
  bundesland: string;
  bundeslandName: string;
  holidays: Holiday[];
  /** Aggregated stats for the header strip. */
  stats: {
    totalWeeks: number;
    holidayWeeks: number;
    activeWeeksByGroup: Record<string, number>;
  };
}

const ISO_WEEK_CACHE = new Map<string, number>();

/** Compute ISO 8601 calendar week number for a given Monday. */
function getIsoWeekNumber(mondayIso: string): number {
  const cached = ISO_WEEK_CACHE.get(mondayIso);
  if (cached !== undefined) return cached;
  const d = new Date(mondayIso + 'T00:00:00Z');
  // Copy date to avoid mutation, set to nearest Thursday: current date + 4 - current day number
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  ISO_WEEK_CACHE.set(mondayIso, week);
  return week;
}

const MONTH_NAMES_DE = [
  'Jan',
  'Feb',
  'Mär',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
];

/**
 * Build the week list for a season using the actual season start/end dates.
 * Works for both winter seasons (Sep→Jul) and summer seasons (Apr→Sep).
 */
export function buildSeasonWeeks(
  seasonStartIso: string,
  seasonEndIso: string,
  holidays: Holiday[]
): CalendarWeek[] {
  const startDate = new Date(seasonStartIso);
  const endDate = new Date(seasonEndIso);

  // Use the actual season boundaries — no artificial Sep→Jul capping.
  // This correctly handles summer seasons (Apr–Sep) that would otherwise
  // be clipped at Jul 31 by the old Sep→Jul range logic.
  const effectiveStart = startDate;
  const effectiveEnd = endDate;

  const baseWeeks = getWeeks(
    effectiveStart.toISOString().slice(0, 10),
    effectiveEnd.toISOString().slice(0, 10),
    holidays
  );

  // Add weekNumber, isoWeek, monthKey, monthLabel, rangeLabel
  return baseWeeks.map((w, i) => {
    const monDate = new Date(w.monday + 'T00:00:00Z');
    const sunDate = new Date(monDate);
    sunDate.setUTCDate(sunDate.getUTCDate() + 6);

    const monthKey = `${monDate.getUTCFullYear()}-${String(monDate.getUTCMonth() + 1).padStart(2, '0')}`;
    const monthLabel = MONTH_NAMES_DE[monDate.getUTCMonth()] ?? '';

    const fmt = (d: Date): string =>
      `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const rangeLabel = `${fmt(monDate)}–${fmt(sunDate)}`;

    return {
      ...w,
      weekNumber: i + 1,
      isoWeek: getIsoWeekNumber(w.monday),
      monthKey,
      monthLabel,
      rangeLabel,
    };
  });
}

function makeStatusKey(groupId: string, weekMonday: string): string {
  return `${groupId}:${weekMonday}`;
}

/**
 * Load the full calendar data for a season: groups, weeks, per-cell status.
 */
export async function getSeasonCalendarData(
  supabase: SupabaseClient<Database>,
  seasonId: string,
  bundeslandOverride?: string
): Promise<SeasonCalendarData> {
  // 1. Load season
  const { data: seasonRow, error: seasonErr } = await supabase
    .from('seasons')
    .select('id, name, start_date, end_date, season_type, club_id')
    .eq('id', seasonId)
    .single();
  if (seasonErr || !seasonRow) {
    throw new Error(`Saison nicht gefunden: ${seasonErr?.message ?? 'no row'}`);
  }

  const season = seasonRow as {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    season_type: string;
    club_id: string;
  };

  // 2. Resolve bundesland: override > club.bundesland > 'HE' fallback
  let bundesland = bundeslandOverride ?? '';
  if (!bundesland) {
    const { data: clubRow } = await supabase
      .from('clubs')
      .select('bundesland')
      .eq('id', season.club_id)
      .single();
    const raw = (clubRow as { bundesland: string | null } | null)?.bundesland ?? null;
    bundesland = resolveBundeslandCode(raw);
  }
  const holidays = await loadHolidaysForState(bundesland);
  const bundeslandName = BUNDESLAND_NAMES[bundesland] ?? bundesland;

  // 3. Build Sep→Jul weeks
  const weeks = buildSeasonWeeks(season.start_date, season.end_date, holidays);

  // 4. Load groups for the club
  const { data: groupsRows, error: groupsErr } = await supabase
    .from('groups')
    .select('id, name, age_group, level, is_active')
    .eq('club_id', season.club_id)
    .eq('is_active', true)
    .order('name');
  if (groupsErr) {
    throw new Error(`Gruppen konnten nicht geladen werden: ${groupsErr.message}`);
  }
  const groups: CalendarGroup[] = (
    (groupsRows ?? []) as Array<{
      id: string;
      name: string;
      age_group: string | null;
      level: string | null;
    }>
  ).map((g) => ({
    id: g.id,
    name: g.name,
    age_group: g.age_group,
    level: g.level,
    color: null,
  }));

  // 5. Load existing week statuses for this season
  const { data: statusRows, error: statusErr } = await supabase
    .from('season_group_weeks')
    .select('group_id, week_monday, is_active, reason')
    .eq('season_id', seasonId);
  if (statusErr) {
    // Table may not exist yet — degrade gracefully, treat as empty
    if (!statusErr.message.toLowerCase().includes('does not exist')) {
      throw new Error(`Wochenstatus konnte nicht geladen werden: ${statusErr.message}`);
    }
  }

  const statusMap: Record<string, GroupWeekStatus> = {};
  for (const row of (statusRows ?? []) as Array<{
    group_id: string;
    week_monday: string;
    is_active: boolean;
    reason: string | null;
  }>) {
    statusMap[makeStatusKey(row.group_id, row.week_monday)] = {
      groupId: row.group_id,
      weekMonday: row.week_monday,
      isActive: row.is_active,
      reason: row.reason,
    };
  }

  // 6. Stats
  const activeWeeksByGroup: Record<string, number> = {};
  for (const g of groups) activeWeeksByGroup[g.id] = 0;
  for (const status of Object.values(statusMap)) {
    if (status.isActive) {
      activeWeeksByGroup[status.groupId] = (activeWeeksByGroup[status.groupId] ?? 0) + 1;
    }
  }

  return {
    season,
    groups,
    weeks,
    statusMap,
    bundesland,
    bundeslandName,
    holidays,
    stats: {
      totalWeeks: weeks.length,
      holidayWeeks: weeks.filter((w) => w.isHolidayWeek).length,
      activeWeeksByGroup,
    },
  };
}

export interface ToggleGroupWeekInput {
  groupId: string;
  weekMonday: string;
  isActive: boolean;
  reason?: string | null;
}

export interface ToggleGroupWeekResult {
  ok: boolean;
  status: GroupWeekStatus;
  /** True if a new row was created, false if an existing one was updated. */
  created: boolean;
}

/**
 * Toggle (upsert) a single group's active status for a given week.
 */
export async function toggleGroupWeek(
  supabase: SupabaseClient<Database>,
  seasonId: string,
  clubId: string,
  input: ToggleGroupWeekInput
): Promise<ToggleGroupWeekResult> {
  const weekNumber = getIsoWeekNumber(input.weekMonday);

  // Check if a row already exists
  const { data: existing } = await supabase
    .from('season_group_weeks')
    .select('id')
    .eq('season_id', seasonId)
    .eq('group_id', input.groupId)
    .eq('week_monday', input.weekMonday)
    .maybeSingle();

  if (existing) {
    const { error: updErr } = await supabase
      .from('season_group_weeks')
      .update({
        is_active: input.isActive,
        reason: input.reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', (existing as { id: string }).id);
    if (updErr) {
      throw new Error(`Update fehlgeschlagen: ${updErr.message}`);
    }
    return {
      ok: true,
      created: false,
      status: {
        groupId: input.groupId,
        weekMonday: input.weekMonday,
        isActive: input.isActive,
        reason: input.reason ?? null,
      },
    };
  }

  const insertPayload = {
    season_id: seasonId,
    club_id: clubId,
    group_id: input.groupId,
    week_monday: input.weekMonday,
    week_number: weekNumber,
    is_active: input.isActive,
    reason: input.reason ?? null,
  };

  const { error: insErr } = await supabase.from('season_group_weeks').insert(insertPayload);
  if (insErr) {
    throw new Error(`Insert fehlgeschlagen: ${insErr.message}`);
  }

  return {
    ok: true,
    created: true,
    status: {
      groupId: input.groupId,
      weekMonday: input.weekMonday,
      isActive: input.isActive,
      reason: input.reason ?? null,
    },
  };
}

export interface BulkToggleInput {
  groupId: string;
  weekMondaYs: string[];
  isActive: boolean;
}

/**
 * Bulk toggle a contiguous range of weeks for one group (drag-select).
 *
 * Implementiert als EINZELNER PostgREST-Upsert statt N-rundreisen durch
 * `toggleGroupWeek`. Voraussetzung: die Tabelle `season_group_weeks` muss
 * einen UNIQUE-Index auf (season_id, group_id, week_monday) haben (alter
 * Code-Path setzte `ON CONFLICT` implizit voraus). Wenn der Constraint
 * fehlt, schlägt der Upsert mit PostgreSQL-Fehler 23505 auf, was Supabase
 * in einen sauberen 500er-Response umsetzt — kein silent fallback auf die
 * alte N+1-Logik.
 */
export async function bulkToggleGroupWeeks(
  supabase: SupabaseClient<Database>,
  seasonId: string,
  clubId: string,
  input: BulkToggleInput
): Promise<{ ok: boolean; affected: number; error?: string }> {
  if (input.weekMondaYs.length === 0) {
    return { ok: true, affected: 0 };
  }

  const rows = input.weekMondaYs.map((weekMonday) => ({
    season_id: seasonId,
    club_id: clubId,
    group_id: input.groupId,
    week_monday: weekMonday,
    week_number: getIsoWeekNumber(weekMonday),
    is_active: input.isActive,
    reason: null,
  }));

  const { error } = await supabase.from('season_group_weeks').upsert(rows, {
    // Unique-Constraint muss auf (season_id, group_id, week_monday) liegen —
    // siehe Migration 20260627_season_group_weeks.sql. Wenn der Constraint
    // dort fehlt, schlägt dieser Upsert sauber mit 500 fehl statt im
    // Hintergrund halb-still durchzurutschen.
    onConflict: 'season_id,group_id,week_monday',
    // Kein `count: 'exact'` — PostgREST liefert das nur für DELETE/SELECT,
    // bei UPSERT gibt es je nach Version einen Fehler (HTTP 400). Wir
    // melden rows.length als `affected` (semantisch: alle angefragten
    // Zeilen sind entweder neu oder aktualisiert; das vorherige Verhalten
    // war identisch, da upsert grundsätzlich N Zeilen trifft).
    ignoreDuplicates: false,
  });

  if (error) {
    return {
      ok: false,
      affected: 0,
      error: error.message,
    };
  }

  return { ok: true, affected: rows.length };
}

/** Export the helper so components can re-render the same Sep→Jul range. */
export { getMonday, BUNDESLAND_NAMES, resolveBundeslandCode };

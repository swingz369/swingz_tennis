/**
 * Saisonplan (ADR-005): Supabase-Client mit RLS statt Drizzle. Admins sehen alle Einträge ihres
 * Vereins, Trainer ihre eigenen, Mitglieder nur veröffentlichte — das entscheidet die Datenbank.
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { Tables, TablesInsert } from '@/types/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:season-plan.repository');

export type Season = Tables<'seasons'>;
export type PlanEntry = Tables<'season_plan_entries'>;
export type PlanEntryWithNames = PlanEntry & {
  trainer_name: string | null;
  court_name: string | null;
  group_name: string | null;
};
export type PlanEntryFilters = {
  trainerId?: string;
  courtId?: string;
  groupId?: string;
  dayOfWeek?: number;
  statuses?: string[];
  entryType?: string;
};

const WITH_NAMES =
  '*, trainers!season_plan_entries_trainer_id_fkey(name), courts(name), groups(name)';

type Joined = PlanEntry & {
  trainers: { name: string | null } | null;
  courts: { name: string | null } | null;
  groups: { name: string | null } | null;
};

function assertNoError(error: { message: string } | null, action: string): void {
  if (error) {
    log.error(action, new Error(error.message));
    throw new Error(action);
  }
}

export class SeasonPlanRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async findSeason(seasonId: string): Promise<Season | null> {
    const { data, error } = await this.db.from('seasons').select().eq('id', seasonId).maybeSingle();
    assertNoError(error, 'Lesen der Saison fehlgeschlagen');
    return data;
  }

  async listEntries(seasonId: string, f: PlanEntryFilters = {}): Promise<PlanEntryWithNames[]> {
    let q = this.db.from('season_plan_entries').select(WITH_NAMES).eq('season_id', seasonId);
    if (f.trainerId) q = q.eq('trainer_id', f.trainerId);
    if (f.courtId) q = q.eq('court_id', f.courtId);
    if (f.groupId) q = q.eq('group_id', f.groupId);
    if (f.dayOfWeek !== undefined) q = q.eq('day_of_week', f.dayOfWeek);
    if (f.statuses?.length) q = q.in('status', f.statuses);
    if (f.entryType) q = q.eq('entry_type', f.entryType);
    const { data, error } = await q
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });
    assertNoError(error, 'Lesen der Planeinträge fehlgeschlagen');
    return ((data ?? []) as unknown as Joined[]).map(({ trainers, courts, groups, ...entry }) => ({
      ...entry,
      trainer_name: trainers?.name ?? null,
      court_name: courts?.name ?? null,
      group_name: groups?.name ?? null,
    }));
  }

  /** Überschneidungen am selben Tag: gleicher Trainer oder (falls angegeben) gleicher Platz. */
  async findConflicts(
    seasonId: string,
    day: number,
    start: string,
    end: string,
    trainerId: string,
    courtId: string | null
  ): Promise<PlanEntry[]> {
    const who = courtId
      ? `trainer_id.eq.${trainerId},court_id.eq.${courtId}`
      : `trainer_id.eq.${trainerId}`;
    const { data, error } = await this.db
      .from('season_plan_entries')
      .select()
      .eq('season_id', seasonId)
      .eq('day_of_week', day)
      .lt('start_time', end)
      .gt('end_time', start)
      .or(who);
    assertNoError(error, 'Prüfen auf Terminkonflikte fehlgeschlagen');
    return data ?? [];
  }

  async insertEntry(input: TablesInsert<'season_plan_entries'>): Promise<PlanEntry> {
    const { data, error } = await this.db
      .from('season_plan_entries')
      .insert(input)
      .select()
      .single();
    assertNoError(error, 'Speichern des Planeintrags fehlgeschlagen');
    return data!;
  }

  async findTrainerIdByUser(userId: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('trainers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    assertNoError(error, 'Lesen des Trainers fehlgeschlagen');
    return data?.id ?? null;
  }

  async listActiveGroups(clubId: string) {
    const { data, error } = await this.db
      .from('groups')
      .select('id, name, level, age_group')
      .eq('club_id', clubId)
      .eq('is_active', true);
    assertNoError(error, 'Gruppen konnten nicht geladen werden.');
    return data ?? [];
  }

  async listCourts(clubId: string) {
    const { data, error } = await this.db.from('courts').select('id, name').eq('club_id', clubId);
    assertNoError(error, 'Plätze konnten nicht geladen werden.');
    return data ?? [];
  }

  async userNames(ids: string[]): Promise<Map<string, string | null>> {
    if (ids.length === 0) return new Map();
    const { data, error } = await this.db.from('users').select('id, full_name').in('id', ids);
    assertNoError(error, 'Lesen der Mitgliedernamen fehlgeschlagen');
    return new Map((data ?? []).map((u) => [u.id, u.full_name]));
  }
}

/**
 * Saisonplanung, Hilfsdaten (ADR-005): Inaktive Wochen, Wartelisten, Planstände, Präferenz- und
 * Trainer-Übersichten. Supabase-Client mit RLS statt Drizzle — Vereinsgrenzen zieht die Datenbank.
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { Json, Tables, TablesInsert, TablesUpdate } from '@/types/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:season-planning.repository');

export type Season = Tables<'seasons'>;
export type Waitlist = Tables<'season_waitlists'>;
export type PlanVersion = Tables<'season_plan_versions'>;
export type PlanEntry = Tables<'season_plan_entries'>;
export type Trainer = Tables<'trainers'>;

function ok<T>(res: { data: T; error: { message: string } | null }, action: string): T {
  if (res.error) {
    log.error(action, new Error(res.error.message));
    throw new Error(action);
  }
  return res.data;
}

export class SeasonPlanningRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async findSeason(seasonId: string): Promise<Season | null> {
    return ok(
      await this.db.from('seasons').select().eq('id', seasonId).maybeSingle(),
      'Lesen der Saison fehlgeschlagen'
    );
  }

  // ── Inaktive Wochen ───────────────────────────────────────────────
  async listGroupWeeks(seasonId: string) {
    return (
      ok(
        await this.db
          .from('season_group_weeks')
          .select('id, group_id, week_number, is_active')
          .eq('season_id', seasonId),
        'Lesen der Wochen fehlgeschlagen'
      ) ?? []
    );
  }

  async updateGroupWeek(id: string, isActive: boolean): Promise<void> {
    ok(
      await this.db
        .from('season_group_weeks')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', id),
      'Ändern der Woche fehlgeschlagen'
    );
  }

  async insertGroupWeeks(rows: TablesInsert<'season_group_weeks'>[]): Promise<void> {
    if (rows.length === 0) return;
    ok(
      await this.db.from('season_group_weeks').insert(rows),
      'Speichern der Wochen fehlgeschlagen'
    );
  }

  // ── Warteliste ────────────────────────────────────────────────────
  async listWaitlist(seasonId: string) {
    const rows = ok(
      await this.db
        .from('season_waitlists')
        .select('*, users(full_name)')
        .eq('season_id', seasonId)
        .order('group_id', { ascending: true })
        .order('position', { ascending: true }),
      'Lesen der Warteliste fehlgeschlagen'
    );
    return (rows ?? []).map(({ users, ...entry }) => ({
      ...(entry as Waitlist),
      member_name: (users as { full_name: string | null } | null)?.full_name ?? null,
    }));
  }

  async findWaitlistEntry(id: string): Promise<Waitlist | null> {
    return ok(
      await this.db.from('season_waitlists').select().eq('id', id).maybeSingle(),
      'Lesen des Wartelisten-Eintrags fehlgeschlagen'
    );
  }

  async updateWaitlist(id: string, patch: TablesUpdate<'season_waitlists'>): Promise<void> {
    ok(
      await this.db.from('season_waitlists').update(patch).eq('id', id),
      'Ändern des Wartelisten-Eintrags fehlgeschlagen'
    );
  }

  async listEntriesForGroup(seasonId: string, groupId: string): Promise<PlanEntry[]> {
    return (
      ok(
        await this.db
          .from('season_plan_entries')
          .select()
          .eq('season_id', seasonId)
          .eq('group_id', groupId),
        'Lesen der Planeinträge fehlgeschlagen'
      ) ?? []
    );
  }

  async listEntries(seasonId: string): Promise<PlanEntry[]> {
    return (
      ok(
        await this.db.from('season_plan_entries').select().eq('season_id', seasonId),
        'Lesen der Planeinträge fehlgeschlagen'
      ) ?? []
    );
  }

  async setParticipants(entryId: string, participants: string[]): Promise<void> {
    ok(
      await this.db
        .from('season_plan_entries')
        .update({ expected_participants: participants })
        .eq('id', entryId),
      'Ändern des Planeintrags fehlgeschlagen'
    );
  }

  // ── Planstände ────────────────────────────────────────────────────
  async listVersions(seasonId: string) {
    const rows = ok(
      await this.db
        .from('season_plan_versions')
        .select('id, label, created_at, slots, users(full_name)')
        .eq('season_id', seasonId)
        .order('created_at', { ascending: false }),
      'Lesen der Planstände fehlgeschlagen'
    );
    return (rows ?? []).map((r) => ({
      id: r.id,
      label: r.label,
      created_at: r.created_at,
      slots: r.slots as Json,
      created_by_name: (r.users as { full_name: string | null } | null)?.full_name ?? null,
    }));
  }

  async insertVersion(input: TablesInsert<'season_plan_versions'>) {
    return ok(
      await this.db.from('season_plan_versions').insert(input).select('id, label').single(),
      'Sichern des Planstands fehlgeschlagen'
    )!;
  }

  async listVersionIds(seasonId: string): Promise<string[]> {
    const rows = ok(
      await this.db
        .from('season_plan_versions')
        .select('id')
        .eq('season_id', seasonId)
        .order('created_at', { ascending: false }),
      'Lesen der Planstände fehlgeschlagen'
    );
    return (rows ?? []).map((r) => r.id);
  }

  async deleteVersions(ids: string[]): Promise<void> {
    ok(
      await this.db.from('season_plan_versions').delete().in('id', ids),
      'Löschen alter Planstände fehlgeschlagen'
    );
  }

  async findVersion(seasonId: string, versionId: string): Promise<PlanVersion | null> {
    return ok(
      await this.db
        .from('season_plan_versions')
        .select()
        .eq('id', versionId)
        .eq('season_id', seasonId)
        .maybeSingle(),
      'Lesen des Planstands fehlgeschlagen'
    );
  }

  // ── Präferenz-Übersicht ───────────────────────────────────────────
  async listMemberPreferences(seasonId: string) {
    const rows = ok(
      await this.db
        .from('user_training_preferences')
        .select('*, users(full_name, email, skill_level, experience_months)')
        .eq('season_id', seasonId)
        .eq('user_role', 'member'),
      'Lesen der Präferenzen fehlgeschlagen'
    );
    return (rows ?? []).map(({ users, ...pref }) => {
      const u = users as {
        full_name: string | null;
        email: string | null;
        skill_level: string | null;
        experience_months: number | null;
      } | null;
      return {
        pref: pref as Tables<'user_training_preferences'>,
        user_name: u?.full_name ?? null,
        user_email: u?.email ?? null,
        skill_level: u?.skill_level ?? null,
        experience_months: u?.experience_months ?? null,
      };
    });
  }

  async countPlannableMembers(clubId: string): Promise<number> {
    const { count, error } = await this.db
      .from('user_club_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('role', 'member')
      .eq('is_active', true)
      .eq('include_in_planning', true);
    ok({ data: null, error }, 'Zählen der Mitglieder fehlgeschlagen');
    return count ?? 0;
  }

  async listStatistics(clubId: string) {
    return (
      ok(
        await this.db.from('season_statistics').select().eq('club_id', clubId),
        'Lesen der Statistik fehlgeschlagen'
      ) ?? []
    );
  }

  // ── Trainer-Übersicht ─────────────────────────────────────────────
  async listSubmittedTrainerPreferences(seasonId: string) {
    const rows = ok(
      await this.db
        .from('user_training_preferences')
        .select('*, users(full_name)')
        .eq('season_id', seasonId)
        .eq('is_submitted', true)
        .eq('user_role', 'trainer'),
      'Lesen der Trainer-Präferenzen fehlgeschlagen'
    );
    return (rows ?? []).map(({ users, ...pref }) => ({
      pref: pref as Tables<'user_training_preferences'>,
      user_name: (users as { full_name: string | null } | null)?.full_name ?? null,
    }));
  }

  async trainersByUserIds(userIds: string[]): Promise<Trainer[]> {
    if (userIds.length === 0) return [];
    return (
      ok(
        await this.db.from('trainers').select().in('user_id', userIds),
        'Lesen der Trainer fehlgeschlagen'
      ) ?? []
    );
  }

  async activeClubTrainers(clubId: string): Promise<Trainer[]> {
    const links = ok(
      await this.db.from('trainer_club').select('trainer_id').eq('club_id', clubId),
      'Lesen der Trainer-Zuordnung fehlgeschlagen'
    );
    const ids = (links ?? []).map((l) => l.trainer_id);
    if (ids.length === 0) return [];
    return (
      ok(
        await this.db.from('trainers').select().in('id', ids).eq('is_active', true),
        'Lesen der Trainer fehlgeschlagen'
      ) ?? []
    );
  }

  async trainerMembershipUserIds(clubId: string): Promise<string[]> {
    const rows = ok(
      await this.db
        .from('user_club_memberships')
        .select('user_id')
        .eq('club_id', clubId)
        .eq('role', 'trainer')
        .eq('is_active', true),
      'Lesen der Trainer-Mitgliedschaften fehlgeschlagen'
    );
    return (rows ?? []).map((r) => r.user_id);
  }

  async findPlanningConfig(seasonId: string) {
    return ok(
      await this.db
        .from('season_planning_configs')
        .select()
        .eq('season_id', seasonId)
        .maybeSingle(),
      'Lesen der Planungs-Konfiguration fehlgeschlagen'
    );
  }
}

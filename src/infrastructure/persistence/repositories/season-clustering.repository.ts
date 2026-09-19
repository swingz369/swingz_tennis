/**
 * Saisonplanung: Clustering-Engine und Dry-Run (ADR-005) — Supabase-Client mit RLS statt Drizzle.
 * Die Methoden liefern dieselbe Zeilenform wie zuvor die Drizzle-Abfragen (Joins werden hier
 * zusammengesetzt), damit die Engine-Logik unverändert bleibt. Nur Vereins-Admins lesen/schreiben
 * die Planungsdaten; für Owner (keine Membership) systemDb.
 *
 * Grenzen: PostgREST liefert höchstens 1000 Zeilen je Abfrage (max-rows). `.in(...)`-Listen
 * werden in Blöcken abgefragt, damit die URL nicht zu lang wird.
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';
import { getUserDb, systemDb } from '@/infrastructure/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:season-clustering.repository');

export type Season = Tables<'seasons'>;
export type PlanEntry = Tables<'season_plan_entries'>;
export type TrainerRow = Tables<'trainers'>;
export type UserBrief = Pick<
  Tables<'users'>,
  'full_name' | 'email' | 'experience_months' | 'skill_level' | 'date_of_birth'
>;

const CHUNK = 100;

function ok<T>(res: { data: T; error: { message: string } | null }, action: string): T {
  if (res.error) {
    log.error(action, new Error(res.error.message));
    throw new Error(action);
  }
  return res.data;
}

async function inChunks<T>(
  ids: string[],
  fetchChunk: (
    chunk: string[]
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  action: string,
  size = CHUNK
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(...(ok(await fetchChunk(ids.slice(i, i + size)), action) ?? []));
  }
  return out;
}

/** `timestamp without time zone` kommt ohne Offset — als UTC lesen wie zuvor Drizzle. */
function toIsoUtc(value: string): string {
  const hasZone = /(Z|[+-]\d{2}(:?\d{2})?)$/.test(value);
  return new Date(hasZone ? value : `${value}Z`).toISOString();
}

/** Repository für den Request: Owner über systemDb, alle anderen mit RLS. */
export function clusteringRepositoryFor(auth: AuthContext): SeasonClusteringRepository {
  return new SeasonClusteringRepository(
    auth.role === 'owner' ? systemDb('Owner: Saisonplanung aller Vereine') : getUserDb(auth)
  );
}

export class SeasonClusteringRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  // ── Saison / Verein ────────────────────────────────────────────────────

  async findSeason(seasonId: string): Promise<Season | null> {
    return ok(
      await this.db.from('seasons').select().eq('id', seasonId).maybeSingle(),
      'Lesen der Saison fehlgeschlagen'
    );
  }

  async updateSeason(seasonId: string, patch: TablesUpdate<'seasons'>): Promise<void> {
    ok(
      await this.db.from('seasons').update(patch).eq('id', seasonId).select('id'),
      'Speichern der Saison fehlgeschlagen'
    );
  }

  /** Saisons desselben Typs im Verein, aufsteigend nach Jahr (Vorsaison-Ermittlung). */
  async seasonIdsOfType(clubId: string, seasonType: string): Promise<string[]> {
    const rows = ok(
      await this.db
        .from('seasons')
        .select('id')
        .eq('club_id', clubId)
        .eq('season_type', seasonType)
        .order('year', { ascending: true }),
      'Lesen der Saisons fehlgeschlagen'
    );
    return (rows ?? []).map((r) => r.id);
  }

  async clubBundesland(clubId: string): Promise<string | null> {
    const row = ok(
      await this.db.from('clubs').select('bundesland').eq('id', clubId).maybeSingle(),
      'Lesen des Vereins fehlgeschlagen'
    );
    return row?.bundesland ?? null;
  }

  async planningConfig(clubId: string, seasonId: string) {
    return ok(
      await this.db
        .from('season_planning_configs')
        .select()
        .eq('club_id', clubId)
        .eq('season_id', seasonId)
        .limit(1)
        .maybeSingle(),
      'Lesen der Planungs-Konfiguration fehlgeschlagen'
    );
  }

  // ── Mitglieder ─────────────────────────────────────────────────────────

  private async usersById(ids: string[]): Promise<Map<string, UserBrief & { id: string }>> {
    const rows = await inChunks(
      ids,
      (chunk) =>
        this.db
          .from('users')
          .select('id, full_name, email, experience_months, skill_level, date_of_birth')
          .in('id', chunk),
      'Lesen der Nutzerprofile fehlgeschlagen'
    );
    return new Map(rows.map((r) => [r.id, r]));
  }

  private async withUsers<P extends { user_id: string }>(prefs: P[]) {
    const users = await this.usersById([...new Set(prefs.map((p) => p.user_id))]);
    // Inner-Join wie zuvor: Präferenzen ohne (per RLS sichtbaren) Nutzer entfallen.
    return prefs.flatMap((pref) => {
      const u = users.get(pref.user_id);
      return u
        ? [
            {
              pref,
              user_name: u.full_name,
              user_email: u.email,
              user_experience: u.experience_months,
              user_skill_level: u.skill_level,
              user_dob: u.date_of_birth,
            },
          ]
        : [];
    });
  }

  /** Eingereichte Saison-Präferenzen der Mitglieder samt Nutzerdaten. */
  async submittedMemberPrefs(seasonId: string) {
    const prefs = ok(
      await this.db
        .from('user_training_preferences')
        .select()
        .eq('season_id', seasonId)
        .eq('is_submitted', true)
        .eq('user_role', 'member'),
      'Lesen der Präferenzen fehlgeschlagen'
    );
    return this.withUsers(prefs ?? []);
  }

  /** Vereinsweite Wunschzeiten (member_schedule_preferences) samt Nutzerdaten. */
  async baselineMemberPrefs(clubId: string) {
    const prefs = ok(
      await this.db.from('member_schedule_preferences').select().eq('club_id', clubId),
      'Lesen der Wunschzeiten fehlgeschlagen'
    );
    return this.withUsers(prefs ?? []);
  }

  async activeMemberships(clubId: string) {
    return (
      ok(
        await this.db
          .from('user_club_memberships')
          .select('user_id, role, include_in_planning')
          .eq('club_id', clubId)
          .eq('is_active', true),
        'Lesen der Mitgliedschaften fehlgeschlagen'
      ) ?? []
    );
  }

  async userProfiles(ids: string[]) {
    const users = await this.usersById(ids);
    return [...users.values()];
  }

  async trainerFeedback(seasonId: string) {
    return (
      ok(
        await this.db.from('trainer_feedback').select().eq('season_id', seasonId),
        'Lesen des Trainer-Feedbacks fehlgeschlagen'
      ) ?? []
    );
  }

  // ── Trainer ────────────────────────────────────────────────────────────

  /** Eingereichte Trainer-Präferenzen mit Nutzername und Trainerzeile (Inner-Join). */
  async submittedTrainerPrefs(seasonId: string) {
    const prefs =
      ok(
        await this.db
          .from('user_training_preferences')
          .select()
          .eq('season_id', seasonId)
          .eq('is_submitted', true)
          .eq('user_role', 'trainer'),
        'Lesen der Trainer-Präferenzen fehlgeschlagen'
      ) ?? [];
    const userIds = [...new Set(prefs.map((p) => p.user_id))];
    const users = await this.usersById(userIds);
    const trainers = await inChunks(
      userIds,
      (chunk) => this.db.from('trainers').select().in('user_id', chunk),
      'Lesen der Trainer fehlgeschlagen'
    );
    const trainerByUser = new Map(trainers.map((t) => [t.user_id, t]));
    return prefs.flatMap((pref) => {
      const u = users.get(pref.user_id);
      const trainer = trainerByUser.get(pref.user_id);
      return u && trainer ? [{ pref, trainer_name: u.full_name, trainer }] : [];
    });
  }

  private async activeTrainersByIds(ids: string[]): Promise<TrainerRow[]> {
    const rows = await inChunks(
      ids,
      (chunk) => this.db.from('trainers').select().in('id', chunk).eq('is_active', true),
      'Lesen der Trainer fehlgeschlagen'
    );
    return rows;
  }

  /** Aktive Trainer des Vereins über trainer_club. */
  async activeClubTrainers(clubId: string): Promise<TrainerRow[]> {
    const links = ok(
      await this.db.from('trainer_club').select('trainer_id').eq('club_id', clubId),
      'Lesen der Trainer-Zuordnung fehlgeschlagen'
    );
    return this.activeTrainersByIds((links ?? []).map((l) => l.trainer_id));
  }

  /** Rückfall: aktive Trainer über Mitgliedschaft mit Rolle `trainer`. */
  async activeTrainersByMembership(clubId: string): Promise<TrainerRow[]> {
    const ms = ok(
      await this.db
        .from('user_club_memberships')
        .select('user_id')
        .eq('club_id', clubId)
        .eq('role', 'trainer')
        .eq('is_active', true),
      'Lesen der Trainer-Mitgliedschaften fehlgeschlagen'
    );
    const rows = await inChunks(
      (ms ?? []).map((m) => m.user_id),
      (chunk) => this.db.from('trainers').select().in('user_id', chunk).eq('is_active', true),
      'Lesen der Trainer fehlgeschlagen'
    );
    return rows;
  }

  // ── Plätze / Gruppen / Statistik ───────────────────────────────────────

  async activeClosures(clubId: string) {
    return (
      ok(
        await this.db
          .from('court_closures')
          .select('court_id, start_date, end_date')
          .eq('club_id', clubId)
          .eq('is_active', true),
        'Lesen der Platzsperren fehlgeschlagen'
      ) ?? []
    );
  }

  async trainingCourts(clubId: string, indoorOnly: boolean) {
    let q = this.db
      .from('courts')
      .select()
      .eq('club_id', clubId)
      .eq('is_active', true)
      .eq('usable_for_training', true);
    if (indoorOnly) q = q.eq('has_indoor', true);
    return ok(await q, 'Lesen der Plätze fehlgeschlagen') ?? [];
  }

  async activeGroups(clubId: string) {
    return (
      ok(
        await this.db
          .from('groups')
          .select('id, name, level, age_group, max_size')
          .eq('club_id', clubId)
          .eq('is_active', true),
        'Lesen der Gruppen fehlgeschlagen'
      ) ?? []
    );
  }

  async seasonStatistics(clubId: string) {
    return (
      ok(
        await this.db
          .from('season_statistics')
          .select()
          .eq('club_id', clubId)
          .order('computed_at', { ascending: true }),
        'Lesen der Saisonstatistik fehlgeschlagen'
      ) ?? []
    );
  }

  async planEntries(seasonId: string): Promise<PlanEntry[]> {
    return (
      ok(
        await this.db.from('season_plan_entries').select().eq('season_id', seasonId),
        'Lesen der Planeinträge fehlgeschlagen'
      ) ?? []
    );
  }

  // ── Dry-Run ────────────────────────────────────────────────────────────

  /** Planeinträge mit veröffentlichter Einheit (Inner-Join auf sessions). */
  async publishedSessionsForDiff(seasonId: string) {
    const entries =
      ok(
        await this.db
          .from('season_plan_entries')
          .select('day_of_week, group_id, start_time, published_session_id')
          .eq('season_id', seasonId)
          .not('published_session_id', 'is', null),
        'Lesen der veröffentlichten Planeinträge fehlgeschlagen'
      ) ?? [];
    const sessionIds = entries.map((e) => e.published_session_id as string);
    const sessions = await inChunks(
      sessionIds,
      (chunk) =>
        this.db.from('sessions').select('id, timeslot_start, trainer_id, court_id').in('id', chunk),
      'Lesen der Einheiten fehlgeschlagen'
    );
    const byId = new Map(sessions.map((s) => [s.id, s]));
    return entries.flatMap((e) => {
      const s = byId.get(e.published_session_id as string);
      return s
        ? [
            {
              id: s.id,
              timeslotStart: toIsoUtc(s.timeslot_start),
              trainerId: s.trainer_id,
              courtId: s.court_id,
              dayOfWeek: e.day_of_week,
              groupId: e.group_id,
              startTime: e.start_time,
            },
          ]
        : [];
    });
  }

  /** Antwort-Status aller RSVPs zu den Einheiten mit `schedule_id = seasonId`. */
  async rsvpStatuses(
    seasonId: string
  ): Promise<{ sessionCount: number; rows: { status: string }[] }> {
    const sessions = ok(
      await this.db.from('sessions').select('id').eq('schedule_id', seasonId),
      'Lesen der Einheiten fehlgeschlagen'
    );
    const ids = (sessions ?? []).map((s) => s.id);
    const rsvps = await inChunks(
      ids,
      (chunk) => this.db.from('session_rsvps').select('status').in('session_id', chunk),
      'Lesen der Zusagen fehlgeschlagen'
    );
    return { sessionCount: ids.length, rows: rsvps };
  }

  // ── Schreiben (saveToDatabase) ─────────────────────────────────────────

  /** IDs künftiger Einheiten, die an den Planeinträgen der Saison hängen. */
  async futureSessionIdsOfSeason(seasonId: string): Promise<string[]> {
    const entries = await this.planEntries(seasonId);
    if (entries.length === 0) return [];
    const now = new Date().toISOString();
    const rows = await inChunks(
      entries.map((e) => e.id),
      (chunk) =>
        this.db.from('sessions').select('id').in('plan_entry_id', chunk).gte('timeslot_start', now),
      'Lesen der künftigen Einheiten fehlgeschlagen'
    );
    return rows.map((r) => r.id);
  }

  /** Löscht Buchungen und Einheiten in 500er-Blöcken (Parameterlimit). */
  async deleteSessionsWithBookings(sessionIds: string[]): Promise<void> {
    for (let i = 0; i < sessionIds.length; i += 500) {
      const chunk = sessionIds.slice(i, i + 500);
      ok(
        await this.db.from('bookings').delete().in('session_id', chunk).select('id'),
        'Löschen der Buchungen fehlgeschlagen'
      );
      ok(
        await this.db.from('sessions').delete().in('id', chunk).select('id'),
        'Löschen der Einheiten fehlgeschlagen'
      );
    }
  }

  async deletePlanEntries(seasonId: string): Promise<void> {
    ok(
      await this.db.from('season_plan_entries').delete().eq('season_id', seasonId).select('id'),
      'Löschen der Planeinträge fehlgeschlagen'
    );
  }

  async deleteWaitlists(seasonId: string): Promise<void> {
    ok(
      await this.db.from('season_waitlists').delete().eq('season_id', seasonId).select('id'),
      'Löschen der Wartelisten fehlgeschlagen'
    );
  }

  async renameGroup(groupId: string, name: string): Promise<void> {
    ok(
      await this.db.from('groups').update({ name }).eq('id', groupId).select('id'),
      'Umbenennen der Gruppe fehlgeschlagen'
    );
  }

  async insertGroup(input: TablesInsert<'groups'>): Promise<string> {
    const row = ok(
      await this.db.from('groups').insert(input).select('id').single(),
      'Anlegen der Gruppe fehlgeschlagen'
    );
    if (!row) throw new Error('Anlegen der Gruppe fehlgeschlagen');
    return row.id;
  }

  async insertPlanEntries(rows: TablesInsert<'season_plan_entries'>[]): Promise<void> {
    if (rows.length === 0) return;
    ok(
      await this.db.from('season_plan_entries').insert(rows).select('id'),
      'Speichern der Planeinträge fehlgeschlagen'
    );
  }

  async insertWaitlist(rows: TablesInsert<'season_waitlists'>[]): Promise<void> {
    if (rows.length === 0) return;
    ok(
      await this.db.from('season_waitlists').insert(rows).select('id'),
      'Speichern der Warteliste fehlgeschlagen'
    );
  }

  // ── Auto-Planung (AutoPlanningService) ─────────────────────────────────

  /** Alle eingereichten Präferenzen der Saison (jede Rolle); der Name fehlt, wenn RLS den Nutzer verbirgt. */
  async submittedPrefsWithNames(seasonId: string) {
    const prefs =
      ok(
        await this.db
          .from('user_training_preferences')
          .select()
          .eq('season_id', seasonId)
          .eq('is_submitted', true),
        'Lesen der Präferenzen fehlgeschlagen'
      ) ?? [];
    const users = await this.usersById([...new Set(prefs.map((p) => p.user_id))]);
    return prefs.map((pref) => {
      const u = users.get(pref.user_id);
      return { pref, user_name: u?.full_name || u?.email || null };
    });
  }

  async activeCourts(clubId: string) {
    return (
      ok(
        await this.db.from('courts').select().eq('club_id', clubId).eq('is_active', true),
        'Lesen der Plätze fehlgeschlagen'
      ) ?? []
    );
  }

  async activeGroupRows(clubId: string) {
    return (
      ok(
        await this.db.from('groups').select().eq('club_id', clubId).eq('is_active', true),
        'Lesen der Gruppen fehlgeschlagen'
      ) ?? []
    );
  }

  async insertPlanningConflicts(rows: TablesInsert<'planning_conflicts'>[]): Promise<void> {
    if (rows.length === 0) return;
    ok(
      await this.db.from('planning_conflicts').insert(rows).select('id'),
      'Speichern der Konflikte fehlgeschlagen'
    );
  }

  async insertPlanningHistory(row: TablesInsert<'season_planning_history'>): Promise<void> {
    ok(
      await this.db.from('season_planning_history').insert(row).select('id'),
      'Speichern des Planungsverlaufs fehlgeschlagen'
    );
  }
}

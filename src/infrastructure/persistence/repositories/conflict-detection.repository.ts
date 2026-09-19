/**
 * Konflikterkennung der Saisonplanung (ADR-005): Supabase-Client mit RLS statt Drizzle.
 * Nur Vereins-Admins haben Zugriff auf die Planungsdaten; für Owner (keine Membership) systemDb.
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { Json, Tables, TablesInsert } from '@/types/supabase';
import { getUserDb, systemDb } from '@/infrastructure/db';
import { createLogger } from '@/lib/logger';
import { fetchAll } from './paged';

const log = createLogger('infrastructure:conflict-detection.repository');

export type PlanEntry = Tables<'season_plan_entries'>;

function ok<T>(res: { data: T; error: { message: string } | null }, action: string): T {
  if (res.error) {
    log.error(action, new Error(res.error.message));
    throw new Error(action);
  }
  return res.data;
}

/** Repository für den Request: Owner über systemDb, alle anderen mit RLS. */
export function conflictRepositoryFor(auth: AuthContext): ConflictDetectionRepository {
  return new ConflictDetectionRepository(
    auth.role === 'owner' ? systemDb('Owner: Konflikterkennung aller Vereine') : getUserDb(auth)
  );
}

export class ConflictDetectionRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async planEntries(seasonId: string): Promise<PlanEntry[]> {
    return (
      (await fetchAll(
        () => this.db.from('season_plan_entries').select().eq('season_id', seasonId).order('id'),
        'Lesen der Planeinträge fehlgeschlagen'
      )) ?? []
    );
  }

  /** Trainer des Vereins (über trainer_club) — nicht die aller Vereine. */
  async clubTrainers(clubId: string) {
    const links = ok(
      await this.db.from('trainer_club').select('trainer_id').eq('club_id', clubId),
      'Lesen der Trainer-Zuordnung fehlgeschlagen'
    );
    const ids = (links ?? []).map((l) => l.trainer_id);
    if (ids.length === 0) return [];
    return (
      (await fetchAll(
        () =>
          this.db.from('trainers').select('id, name, max_hours_per_week').in('id', ids).order('id'),
        'Lesen der Trainer fehlgeschlagen'
      )) ?? []
    );
  }

  async courts(clubId: string) {
    return (
      (await fetchAll(
        () => this.db.from('courts').select('id, name').eq('club_id', clubId).order('id'),
        'Lesen der Plätze fehlgeschlagen'
      )) ?? []
    );
  }

  async groups(clubId: string) {
    return (
      (await fetchAll(
        () =>
          this.db.from('groups').select('id, name, member_ids').eq('club_id', clubId).order('id'),
        'Lesen der Gruppen fehlgeschlagen'
      )) ?? []
    );
  }

  async userNames(ids: string[]): Promise<{ id: string; name: string | null }[]> {
    if (ids.length === 0) return [];
    const rows = await fetchAll(
      () => this.db.from('users').select('id, full_name').in('id', ids).order('id'),
      'Lesen der Mitgliedernamen fehlgeschlagen'
    );
    return (rows ?? []).map((r) => ({ id: r.id, name: r.full_name }));
  }

  /**
   * Planungsrelevante Mitglieder samt Präferenzen. Wer nichts abgegeben hat, muss trotzdem
   * auftauchen — sonst fällt genau diese Gruppe aus der Prüfung heraus.
   */
  async plannableMembers(seasonId: string, clubId: string) {
    const memberships = await fetchAll(
      () =>
        this.db
          .from('user_club_memberships')
          .select('user_id, users!user_club_memberships_user_id_fkey(full_name, skill_level)')
          .eq('club_id', clubId)
          .eq('role', 'member')
          .eq('is_active', true)
          .eq('include_in_planning', true)
          .order('id'),
      'Lesen der Mitglieder fehlgeschlagen'
    );
    const prefs = await fetchAll(
      () =>
        this.db
          .from('user_training_preferences')
          .select('user_id, weekly_availability, is_submitted, avoid_member_ids')
          .eq('season_id', seasonId)
          .eq('user_role', 'member')
          .order('id'),
      'Lesen der Präferenzen fehlgeschlagen'
    );
    const prefBy = new Map((prefs ?? []).map((p) => [p.user_id, p]));
    return (memberships ?? []).map((m) => {
      const u = m.users as { full_name: string | null; skill_level: string | null } | null;
      const p = prefBy.get(m.user_id);
      return {
        id: m.user_id,
        name: u?.full_name ?? null,
        skill_level: u?.skill_level ?? null,
        availability: (p?.weekly_availability ?? null) as Json | null,
        submitted: p?.is_submitted ?? null,
        avoid_member_ids: (p?.avoid_member_ids ?? null) as string[] | null,
      };
    });
  }

  async statistics(clubId: string) {
    return (
      (await fetchAll(
        () =>
          this.db
            .from('season_statistics')
            .select('slot_failure_rates')
            .eq('club_id', clubId)
            .order('id'),
        'Lesen der Statistik fehlgeschlagen'
      )) ?? []
    );
  }

  async planningConfig(seasonId: string) {
    return ok(
      await this.db
        .from('season_planning_configs')
        .select()
        .eq('season_id', seasonId)
        .maybeSingle(),
      'Lesen der Planungs-Konfiguration fehlgeschlagen'
    );
  }

  /** Gespeicherte Entscheidungen (gelöst/ignoriert) zu einer Saison. */
  async conflictDecisions(seasonId: string): Promise<{ id: string; status: string }[]> {
    return (
      (await fetchAll(
        () =>
          this.db
            .from('planning_conflicts')
            .select('id, status')
            .eq('season_id', seasonId)
            .order('id'),
        'Lesen der Konflikt-Entscheidungen fehlgeschlagen'
      )) ?? []
    );
  }

  /** Offene Konflikte der Saison ersetzen (Re-Erkennung bei jedem Lauf). */
  async replaceOpenConflicts(
    seasonId: string,
    rows: TablesInsert<'planning_conflicts'>[]
  ): Promise<void> {
    ok(
      await this.db
        .from('planning_conflicts')
        .delete()
        .eq('season_id', seasonId)
        .eq('status', 'open'),
      'Löschen alter Konflikte fehlgeschlagen'
    );
    if (rows.length > 0) {
      ok(
        await this.db.from('planning_conflicts').insert(rows),
        'Speichern der Konflikte fehlgeschlagen'
      );
    }
  }

  /** Entscheidung (gelöst/ignoriert) unter der stabilen Zeilen-ID anlegen oder überschreiben. */
  async saveDecision(row: TablesInsert<'planning_conflicts'>): Promise<void> {
    ok(
      await this.db.from('planning_conflicts').upsert(row, { onConflict: 'id' }),
      'Speichern der Konflikt-Entscheidung fehlgeschlagen'
    );
  }
}

/**
 * Vereins-Stammdaten für ADR-005. Ein Repository, Supabase-Client mit
 * Nutzer-Token (RLS: clubs_update = Vereins-Admin/Owner, clubs_delete =
 * Superadmin des Vereins). Endgültiges Löschen durch den Owner läuft über
 * `systemDb` im Service, nicht hier.
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { Tables, TablesUpdate } from '@/types/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:club.repository');

export type ClubRow = Tables<'clubs'>;

export type RestoreResult =
  | { status: 'not_found' }
  | { status: 'not_deleted'; current_status: string | null }
  | { status: 'restored'; name: string; previous_deleted_at: string; reactivated: number };

function assertNoError(error: { message: string } | null, action: string): void {
  if (error) {
    log.error(action, new Error(error.message));
    throw new Error(action);
  }
}

export class ClubRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async findById(id: string): Promise<ClubRow | null> {
    const { data, error } = await this.db.from('clubs').select().eq('id', id).maybeSingle();
    assertNoError(error, 'Lesen des Vereins fehlgeschlagen');
    return data;
  }

  /** Öffentliche Vereinsliste (Probetraining-Auswahl) — gelöschte Vereine fehlen. */
  async listPublic(): Promise<{ id: string; name: string }[]> {
    const { data, error } = await this.db
      .from('clubs')
      .select('id, name')
      .is('deleted_at', null)
      .order('name')
      .order('id');
    assertNoError(error, 'Lesen der Vereinsliste fehlgeschlagen');
    return data ?? [];
  }

  async update(id: string, patch: TablesUpdate<'clubs'>): Promise<void> {
    const { error } = await this.db
      .from('clubs')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    assertNoError(error, 'Speichern des Vereins fehlgeschlagen');
  }

  async countActiveMembers(id: string): Promise<number> {
    const { count, error } = await this.db
      .from('user_club_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', id)
      .eq('role', 'member')
      .eq('is_active', true);
    assertNoError(error, 'Zählen der Mitglieder fehlgeschlagen');
    return count ?? 0;
  }

  async countMemberships(id: string): Promise<number> {
    const { count, error } = await this.db
      .from('user_club_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', id);
    assertNoError(error, 'Zählen der Mitgliedschaften fehlgeschlagen');
    return count ?? 0;
  }

  /** Atomar: Status 'deleted' + alle Mitgliedschaften deaktivieren. Liefert deren Anzahl. */
  async softDelete(id: string, reason: string | null): Promise<number> {
    const { data, error } = await this.db.rpc('soft_delete_club', {
      p_club_id: id,
      p_reason: reason ?? undefined,
    });
    assertNoError(error, 'Löschen des Vereins fehlgeschlagen');
    return data ?? 0;
  }

  /** Atomar: Verein reaktivieren + Mitgliedschaften wieder an. Berechtigung prüft die DB-Funktion. */
  async restore(id: string): Promise<RestoreResult> {
    const { data, error } = await this.db.rpc('restore_club', { p_club_id: id });
    assertNoError(error, 'Wiederherstellen des Vereins fehlgeschlagen');
    return data as RestoreResult;
  }

  async hardDelete(id: string): Promise<void> {
    const { error } = await this.db.from('clubs').delete().eq('id', id);
    assertNoError(error, 'Endgültiges Löschen des Vereins fehlgeschlagen');
  }
}

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

  async hardDelete(id: string): Promise<void> {
    const { error } = await this.db.from('clubs').delete().eq('id', id);
    assertNoError(error, 'Endgültiges Löschen des Vereins fehlgeschlagen');
  }
}

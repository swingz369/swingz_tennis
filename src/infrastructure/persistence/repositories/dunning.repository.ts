/**
 * Mitglieder-Teildomäne "Mahnwesen" für ADR-005 (Domäne Abrechnung, Teil 2,
 * Zahlungsseite). Ein Repository für dunning_records, kein Adapter, keine
 * Interfaces — Muster in docs/ARCHIV/2026-09-13-architektur-analyse-datenzugriff.md § 6.
 *
 * Ersetzt `lib/billing/dunning.service.ts` (Singleton auf
 * `createServiceClient()`, kein RLS). RLS auf `dunning_records` steht bereits
 * korrekt (admins_can_manage_dunning, members_can_view_own_dunning*, live per
 * pg_policies geprüft, 14.09.2026) — kein neuer Migrationsschritt nötig, nur
 * der Datenzugriff wechselt auf `getUserDb(auth)` bzw. `systemDb(reason)` für
 * den Cron-Lauf ohne User-Kontext.
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { Tables, TablesInsert } from '@/types/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:dunning.repository');

export type DunningRecord = Tables<'dunning_records'>;

function assertNoError(error: { message: string } | null, action: string): void {
  if (error) {
    log.error(action, new Error(error.message));
    throw new Error(action);
  }
}

export class DunningRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async create(input: TablesInsert<'dunning_records'>): Promise<DunningRecord> {
    const { data, error } = await this.db.from('dunning_records').insert(input).select().single();
    assertNoError(error, 'Anlegen des Mahndatensatzes fehlgeschlagen');
    return data!;
  }

  async findByInvoiceId(invoiceId: string): Promise<DunningRecord[]> {
    const { data, error } = await this.db
      .from('dunning_records')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('level', { ascending: true });
    assertNoError(error, 'Lesen der Mahndatensätze fehlgeschlagen');
    return data ?? [];
  }

  /** Höchste bisher versendete Mahnstufe zu einer Rechnung (für processAutomaticDunning). */
  async findLatestByInvoiceId(invoiceId: string): Promise<DunningRecord | null> {
    const { data, error } = await this.db
      .from('dunning_records')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('level', { ascending: false })
      .limit(1);
    assertNoError(error, 'Lesen des letzten Mahndatensatzes fehlgeschlagen');
    return data?.[0] ?? null;
  }

  async findByClub(clubId: string, limit = 100): Promise<DunningRecord[]> {
    const { data, error } = await this.db
      .from('dunning_records')
      .select('*')
      .eq('club_id', clubId)
      .order('sent_at', { ascending: false })
      .limit(limit);
    assertNoError(error, 'Lesen der Mahnläufe fehlgeschlagen');
    return data ?? [];
  }
}

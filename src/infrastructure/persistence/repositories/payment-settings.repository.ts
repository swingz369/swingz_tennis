/**
 * Dritte migrierte Domäne für Option B (ADR-005). Ein Repository, kein
 * Adapter, keine Interfaces — Muster in docs/ARCHIV/2026-09-13-architektur-
 * analyse-datenzugriff.md § 6. RLS-Policy: supabase/migrations/
 * 20260913150000_payment_settings_rls.sql (`payment_settings_admin_manage`).
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:payment-settings.repository');

export type PaymentSettings = Tables<'payment_settings'>;

function assertNoError(error: { message: string } | null, action: string): void {
  if (error) {
    log.error(action, new Error(error.message));
    throw new Error(action);
  }
}

export class PaymentSettingsRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  async create(input: TablesInsert<'payment_settings'>): Promise<PaymentSettings> {
    const { data, error } = await this.db.from('payment_settings').insert(input).select().single();
    assertNoError(error, 'Anlegen der Zahlungseinstellungen fehlgeschlagen');
    return data!;
  }

  async findById(id: string, clubId: string): Promise<PaymentSettings | null> {
    const { data, error } = await this.db
      .from('payment_settings')
      .select()
      .eq('id', id)
      .eq('club_id', clubId)
      .maybeSingle();
    assertNoError(error, 'Lesen der Zahlungseinstellungen fehlgeschlagen');
    return data;
  }

  async findAll(clubId: string): Promise<PaymentSettings[]> {
    const { data, error } = await this.db
      .from('payment_settings')
      .select()
      .eq('club_id', clubId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    assertNoError(error, 'Lesen der Zahlungseinstellungen fehlgeschlagen');
    return data ?? [];
  }

  async findActive(clubId: string): Promise<PaymentSettings[]> {
    const { data, error } = await this.db
      .from('payment_settings')
      .select()
      .eq('club_id', clubId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    assertNoError(error, 'Lesen der aktiven Zahlungseinstellungen fehlgeschlagen');
    return data ?? [];
  }

  async findDefault(clubId: string): Promise<PaymentSettings | null> {
    const { data, error } = await this.db
      .from('payment_settings')
      .select()
      .eq('club_id', clubId)
      .eq('is_default', true)
      .maybeSingle();
    assertNoError(error, 'Lesen der Standard-Zahlungseinstellungen fehlgeschlagen');
    return data;
  }

  async findByGateway(
    gateway: PaymentSettings['gateway'],
    clubId: string
  ): Promise<PaymentSettings[]> {
    const { data, error } = await this.db
      .from('payment_settings')
      .select()
      .eq('gateway', gateway)
      .eq('club_id', clubId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    assertNoError(error, 'Lesen der Zahlungseinstellungen fehlgeschlagen');
    return data ?? [];
  }

  async update(
    id: string,
    input: TablesUpdate<'payment_settings'>,
    clubId: string
  ): Promise<PaymentSettings | null> {
    const { data, error } = await this.db
      .from('payment_settings')
      .update(input)
      .eq('id', id)
      .eq('club_id', clubId)
      .select()
      .maybeSingle();
    assertNoError(error, 'Aktualisieren der Zahlungseinstellungen fehlgeschlagen');
    return data;
  }

  /** Setzt `id` als Standard. Der Trigger aus der Baseline-Migration hebt den bisherigen Standard auf. */
  async setAsDefault(id: string, clubId: string): Promise<PaymentSettings | null> {
    const { data, error } = await this.db
      .from('payment_settings')
      .update({ is_default: true })
      .eq('id', id)
      .eq('club_id', clubId)
      .select()
      .maybeSingle();
    assertNoError(error, 'Setzen der Standard-Zahlungseinstellungen fehlgeschlagen');
    return data;
  }

  async delete(id: string, clubId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('payment_settings')
      .delete()
      .eq('id', id)
      .eq('club_id', clubId)
      .select('id');
    assertNoError(error, 'Löschen der Zahlungseinstellungen fehlgeschlagen');
    return (data ?? []).length > 0;
  }
}

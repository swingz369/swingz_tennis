/**
 * Referenzdomäne für den Umbau auf Option B (ADR-005): Supabase-Client statt
 * Drizzle, RLS erzwingt die Mandantentrennung statt Anwendungscode. Ein
 * Repository für die ganze Domäne, keine Interfaces, kein Adapter — Muster
 * für die weiteren Domänen in docs/ARCHIV/2026-09-13-architektur-analyse-
 * datenzugriff.md § 6 Phase 3.
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:hourly-rate.repository');

export type HourlyRateTier = Tables<'hourly_rate_tiers'>;
export type TrainerHourlyRate = Tables<'trainer_hourly_rates'>;
export type RateHistoryEntry = Tables<'rate_history'>;

/**
 * Wirft bei einem PostgREST-Fehler einen generischen Error. withAuth (lib/
 * api-auth.ts) fängt alles, was keine ApiException ist, als 500 mit
 * Ersatztext ab — der echte Fehler steht im Server-Log, nicht in der
 * Antwort (lib/api-error.ts).
 */
function assertNoError(error: { message: string } | null, action: string): void {
  if (error) {
    log.error(action, new Error(error.message));
    throw new Error(action);
  }
}

export class HourlyRateRepository {
  constructor(private readonly db: AuthContext['supabase']) {}

  // ═══ Rate Tiers ═══

  async createTier(input: TablesInsert<'hourly_rate_tiers'>): Promise<HourlyRateTier> {
    const { data, error } = await this.db.from('hourly_rate_tiers').insert(input).select().single();
    assertNoError(error, 'Anlegen der Tarifstufe fehlgeschlagen');
    return data!;
  }

  async findTierById(id: string): Promise<HourlyRateTier | null> {
    const { data, error } = await this.db
      .from('hourly_rate_tiers')
      .select()
      .eq('id', id)
      .maybeSingle();
    assertNoError(error, 'Lesen der Tarifstufe fehlgeschlagen');
    return data;
  }

  async findTiers(clubId: string, opts: { activeOnly?: boolean } = {}): Promise<HourlyRateTier[]> {
    let query = this.db.from('hourly_rate_tiers').select().eq('club_id', clubId);
    if (opts.activeOnly) query = query.eq('is_active', true);
    const { data, error } = await query.order('created_at', { ascending: false });
    assertNoError(error, 'Lesen der Tarifstufen fehlgeschlagen');
    return data ?? [];
  }

  async updateTier(
    id: string,
    input: TablesUpdate<'hourly_rate_tiers'>
  ): Promise<HourlyRateTier | null> {
    const { data, error } = await this.db
      .from('hourly_rate_tiers')
      .update(input)
      .eq('id', id)
      .select()
      .maybeSingle();
    assertNoError(error, 'Aktualisieren der Tarifstufe fehlgeschlagen');
    return data;
  }

  async deleteTier(id: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('hourly_rate_tiers')
      .delete()
      .eq('id', id)
      .select('id');
    assertNoError(error, 'Löschen der Tarifstufe fehlgeschlagen');
    return (data ?? []).length > 0;
  }

  // ═══ Trainer Rates ═══

  async createTrainerRate(input: TablesInsert<'trainer_hourly_rates'>): Promise<TrainerHourlyRate> {
    const { data, error } = await this.db
      .from('trainer_hourly_rates')
      .insert(input)
      .select()
      .single();
    assertNoError(error, 'Anlegen des Trainer-Stundensatzes fehlgeschlagen');
    return data!;
  }

  async findTrainerRateById(id: string): Promise<TrainerHourlyRate | null> {
    const { data, error } = await this.db
      .from('trainer_hourly_rates')
      .select()
      .eq('id', id)
      .maybeSingle();
    assertNoError(error, 'Lesen des Trainer-Stundensatzes fehlgeschlagen');
    return data;
  }

  /** Der aktuell gültige Satz eines Trainers (validFrom <= heute <= validUntil). */
  async findCurrentTrainerRate(trainerId: string): Promise<TrainerHourlyRate | null> {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await this.db
      .from('trainer_hourly_rates')
      .select()
      .eq('trainer_id', trainerId)
      .lte('valid_from', today)
      .or(`valid_until.is.null,valid_until.gte.${today}`)
      .order('valid_from', { ascending: false })
      .limit(1)
      .maybeSingle();
    assertNoError(error, 'Lesen des aktuellen Trainer-Stundensatzes fehlgeschlagen');
    return data;
  }

  async findTrainerRates(clubId: string): Promise<TrainerHourlyRate[]> {
    const { data, error } = await this.db
      .from('trainer_hourly_rates')
      .select()
      .eq('club_id', clubId)
      .order('created_at', { ascending: false });
    assertNoError(error, 'Lesen der Trainer-Stundensätze fehlgeschlagen');
    return data ?? [];
  }

  async updateTrainerRate(
    id: string,
    input: TablesUpdate<'trainer_hourly_rates'>
  ): Promise<TrainerHourlyRate | null> {
    const { data, error } = await this.db
      .from('trainer_hourly_rates')
      .update(input)
      .eq('id', id)
      .select()
      .maybeSingle();
    assertNoError(error, 'Aktualisieren des Trainer-Stundensatzes fehlgeschlagen');
    return data;
  }

  async deleteTrainerRate(id: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('trainer_hourly_rates')
      .delete()
      .eq('id', id)
      .select('id');
    assertNoError(error, 'Löschen des Trainer-Stundensatzes fehlgeschlagen');
    return (data ?? []).length > 0;
  }

  // ═══ Rate History ═══

  async addHistoryEntry(entry: TablesInsert<'rate_history'>): Promise<RateHistoryEntry> {
    const { data, error } = await this.db.from('rate_history').insert(entry).select().single();
    assertNoError(error, 'Anlegen des Historieneintrags fehlgeschlagen');
    return data!;
  }

  async findHistoryForTrainer(trainerId: string): Promise<RateHistoryEntry[]> {
    const { data, error } = await this.db
      .from('rate_history')
      .select()
      .eq('trainer_id', trainerId)
      .order('changed_at', { ascending: false });
    assertNoError(error, 'Lesen der Satz-Historie fehlgeschlagen');
    return data ?? [];
  }

  async findHistory(clubId: string): Promise<RateHistoryEntry[]> {
    const { data, error } = await this.db
      .from('rate_history')
      .select()
      .eq('club_id', clubId)
      .order('changed_at', { ascending: false });
    assertNoError(error, 'Lesen der Satz-Historie fehlgeschlagen');
    return data ?? [];
  }
}

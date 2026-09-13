import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import type { TablesInsert, TablesUpdate } from '@/types/supabase';
import { getUserDb } from '@/infrastructure/db';
import {
  HourlyRateRepository,
  type HourlyRateTier,
  type TrainerHourlyRate,
  type RateHistoryEntry,
} from '@/infrastructure/persistence/repositories/hourly-rate.repository';

export type CreateTierInput = Omit<TablesInsert<'hourly_rate_tiers'>, 'club_id' | 'id'>;
export type UpdateTierInput = Omit<TablesUpdate<'hourly_rate_tiers'>, 'club_id' | 'id'>;
export type CreateTrainerRateInput = Omit<
  TablesInsert<'trainer_hourly_rates'>,
  'club_id' | 'id' | 'effective_rate'
>;
export type UpdateTrainerRateInput = Pick<
  TablesUpdate<'trainer_hourly_rates'>,
  'override_rate' | 'valid_until' | 'reason'
>;

/**
 * Referenz-Service für Option B (ADR-005): ein Modul pro Domäne, ein
 * Repository, kein Adapter, keine Interfaces. Fachlogik hier (Effektivsatz,
 * Historie), Datenzugriff ausschliesslich im Repository.
 */
export class HourlyRateService {
  private readonly repo: HourlyRateRepository;

  constructor(auth: AuthContext) {
    this.repo = new HourlyRateRepository(getUserDb(auth));
  }

  // ═══ Rate Tiers ═══

  async createTier(clubId: string, input: CreateTierInput): Promise<HourlyRateTier> {
    return this.repo.createTier({ ...input, club_id: clubId });
  }

  async getTierById(id: string): Promise<HourlyRateTier> {
    const tier = await this.repo.findTierById(id);
    if (!tier) throw new ApiException('NOT_FOUND', 'Tarifstufe nicht gefunden');
    return tier;
  }

  async listTiers(clubId: string, activeOnly = false): Promise<HourlyRateTier[]> {
    return this.repo.findTiers(clubId, { activeOnly });
  }

  async updateTier(id: string, input: UpdateTierInput): Promise<HourlyRateTier> {
    const updated = await this.repo.updateTier(id, input);
    if (!updated) throw new ApiException('NOT_FOUND', 'Tarifstufe nicht gefunden');
    return updated;
  }

  async deleteTier(id: string): Promise<void> {
    const deleted = await this.repo.deleteTier(id);
    if (!deleted) throw new ApiException('NOT_FOUND', 'Tarifstufe nicht gefunden');
  }

  // ═══ Trainer Rates ═══

  async createTrainerRate(
    clubId: string,
    input: CreateTrainerRateInput
  ): Promise<TrainerHourlyRate> {
    const effectiveRate = input.override_rate ?? input.base_rate;
    return this.repo.createTrainerRate({
      ...input,
      club_id: clubId,
      effective_rate: effectiveRate,
    });
  }

  async getTrainerRateById(id: string): Promise<TrainerHourlyRate> {
    const rate = await this.repo.findTrainerRateById(id);
    if (!rate) throw new ApiException('NOT_FOUND', 'Trainer-Stundensatz nicht gefunden');
    return rate;
  }

  async getCurrentTrainerRate(trainerId: string): Promise<TrainerHourlyRate> {
    const rate = await this.repo.findCurrentTrainerRate(trainerId);
    if (!rate) throw new ApiException('NOT_FOUND', 'Kein gültiger Trainer-Stundensatz gefunden');
    return rate;
  }

  async listTrainerRates(clubId: string): Promise<TrainerHourlyRate[]> {
    return this.repo.findTrainerRates(clubId);
  }

  /** Aktualisiert einen Satz und schreibt bei tatsächlicher Änderung einen Historieneintrag. */
  async updateTrainerRate(
    id: string,
    changedBy: string,
    input: UpdateTrainerRateInput
  ): Promise<TrainerHourlyRate> {
    const existing = await this.repo.findTrainerRateById(id);
    if (!existing) throw new ApiException('NOT_FOUND', 'Trainer-Stundensatz nicht gefunden');

    const newEffectiveRate = input.override_rate ?? existing.base_rate;

    const updated = await this.repo.updateTrainerRate(id, {
      override_rate: input.override_rate,
      valid_until: input.valid_until,
      reason: input.reason,
      effective_rate: newEffectiveRate,
    });
    if (!updated) throw new ApiException('NOT_FOUND', 'Trainer-Stundensatz nicht gefunden');

    if (newEffectiveRate !== existing.effective_rate) {
      await this.repo.addHistoryEntry({
        club_id: existing.club_id,
        trainer_id: existing.trainer_id,
        trainer_name: existing.trainer_name,
        old_rate: existing.effective_rate,
        new_rate: newEffectiveRate,
        changed_by: changedBy,
        reason: input.reason ?? null,
      });
    }

    return updated;
  }

  async deleteTrainerRate(id: string): Promise<void> {
    const deleted = await this.repo.deleteTrainerRate(id);
    if (!deleted) throw new ApiException('NOT_FOUND', 'Trainer-Stundensatz nicht gefunden');
  }

  // ═══ Rate History ═══

  async getHistoryForTrainer(trainerId: string): Promise<RateHistoryEntry[]> {
    return this.repo.findHistoryForTrainer(trainerId);
  }

  async getHistory(clubId: string): Promise<RateHistoryEntry[]> {
    return this.repo.findHistory(clubId);
  }
}

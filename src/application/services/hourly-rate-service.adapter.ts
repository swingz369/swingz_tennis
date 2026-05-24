/**
 * Hourly Rate Service Adapter
 *
 * Drizzle-based hourly rate operations.
 *
 * Usage:
 * ```typescript
 * import { hourlyRateService } from '@/application/services/hourly-rate-service.adapter';
 *
 * const tiers = await hourlyRateService.getAllHourlyRateTiers();
 * ```
 */

import type {
  HourlyRateTier,
  TrainerHourlyRate,
  RateHistoryEntry,
  CreateHourlyRateTierInput,
  UpdateHourlyRateTierInput,
  CreateTrainerHourlyRateInput,
  UpdateTrainerHourlyRateInput,
} from '@/domain/entities/hourly-rate.entity';
import { HourlyRateService } from './hourly-rate.service';
import {
  HourlyRateTierRepository,
  TrainerHourlyRateRepository,
  RateHistoryRepository,
} from '@/infrastructure/persistence/repositories/hourly-rate.repository';

class HourlyRateServiceAdapter {
  private tierRepo = new HourlyRateTierRepository();
  private trainerRateRepo = new TrainerHourlyRateRepository();
  private historyRepo = new RateHistoryRepository();

  // ==============================================================================
  // Validation
  // ==============================================================================

  validateHourlyRateTierInput(input: CreateHourlyRateTierInput): {
    valid: boolean;
    errors: string[];
  } {
    return HourlyRateService.validateHourlyRateTierInput(input);
  }

  validateTrainerHourlyRateInput(input: CreateTrainerHourlyRateInput): {
    valid: boolean;
    errors: string[];
  } {
    return HourlyRateService.validateTrainerHourlyRateInput(input);
  }

  // ==============================================================================
  // Hourly Rate Tiers
  // ==============================================================================

  async createHourlyRateTier(input: CreateHourlyRateTierInput): Promise<HourlyRateTier> {
    const validation = this.validateHourlyRateTierInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    return this.tierRepo.create(input);
  }

  async getHourlyRateTierById(id: string): Promise<HourlyRateTier | null> {
    return this.tierRepo.findById(id);
  }

  async getAllHourlyRateTiers(): Promise<HourlyRateTier[]> {
    return this.tierRepo.findAll();
  }

  async getActiveHourlyRateTiers(): Promise<HourlyRateTier[]> {
    return this.tierRepo.findActive();
  }

  async getHourlyRateTiersByClubId(clubId: string): Promise<HourlyRateTier[]> {
    return this.tierRepo.findByClubId(clubId);
  }

  async updateHourlyRateTier(
    id: string,
    input: UpdateHourlyRateTierInput
  ): Promise<HourlyRateTier | null> {
    return this.tierRepo.update(id, input);
  }

  async deleteHourlyRateTier(id: string): Promise<boolean> {
    return this.tierRepo.delete(id);
  }

  // ==============================================================================
  // Trainer Hourly Rates
  // ==============================================================================

  async createTrainerHourlyRate(input: CreateTrainerHourlyRateInput): Promise<TrainerHourlyRate> {
    const validation = this.validateTrainerHourlyRateInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    return this.trainerRateRepo.create(input);
  }

  async getTrainerHourlyRateById(id: string): Promise<TrainerHourlyRate | null> {
    return this.trainerRateRepo.findById(id);
  }

  async getTrainerHourlyRateByTrainerId(trainerId: string): Promise<TrainerHourlyRate | null> {
    return this.trainerRateRepo.findByTrainerId(trainerId);
  }

  async getAllTrainerHourlyRates(): Promise<TrainerHourlyRate[]> {
    return this.trainerRateRepo.findAll();
  }

  async getTrainerHourlyRatesByClubId(clubId: string): Promise<TrainerHourlyRate[]> {
    return this.trainerRateRepo.findByClubId(clubId);
  }

  async updateTrainerHourlyRate(
    id: string,
    input: UpdateTrainerHourlyRateInput
  ): Promise<TrainerHourlyRate | null> {
    return this.trainerRateRepo.update(id, input);
  }

  async deleteTrainerHourlyRate(id: string): Promise<boolean> {
    return this.trainerRateRepo.delete(id);
  }

  async calculateEffectiveRate(trainerId: string): Promise<number | null> {
    return this.trainerRateRepo.calculateEffectiveRate(trainerId);
  }

  // ==============================================================================
  // Rate History
  // ==============================================================================

  async getRateHistoryForTrainer(trainerId: string): Promise<RateHistoryEntry[]> {
    return this.historyRepo.findByTrainerId(trainerId);
  }

  async getAllRateHistory(): Promise<RateHistoryEntry[]> {
    return this.historyRepo.findAll();
  }

  async getRateHistoryByClubId(clubId: string): Promise<RateHistoryEntry[]> {
    return this.historyRepo.findByClubId(clubId);
  }
}

// Export singleton instance
export const hourlyRateService = new HourlyRateServiceAdapter();

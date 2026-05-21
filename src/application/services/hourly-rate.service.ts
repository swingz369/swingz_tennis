import type {
  HourlyRateTier,
  TrainerHourlyRate,
  RateHistoryEntry,
  CreateHourlyRateTierInput,
  UpdateHourlyRateTierInput,
  CreateTrainerHourlyRateInput,
  UpdateTrainerHourlyRateInput,
} from '../../domain/entities/hourly-rate.entity';
import {
  HourlyRateTierRepository,
  TrainerHourlyRateRepository,
  RateHistoryRepository,
} from '../../infrastructure/persistence/repositories/hourly-rate.repository';

/**
 * HourlyRateService — Drizzle-backed service.
 * All data operations go through Drizzle repositories directly.
 */
export class HourlyRateService {
  private static tierRepo = new HourlyRateTierRepository();
  private static trainerRateRepo = new TrainerHourlyRateRepository();
  private static historyRepo = new RateHistoryRepository();

  /**
   * Validate hourly rate tier input
   */
  static validateHourlyRateTierInput(input: CreateHourlyRateTierInput): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!input.name || input.name.trim().length < 2) {
      errors.push('Name muss mindestens 2 Zeichen lang sein');
    }

    if (!input.baseRate || input.baseRate < 0) {
      errors.push('Basisrate muss positiv sein');
    }

    if (!input.trainingTypes || input.trainingTypes.length === 0) {
      errors.push('Mindestens ein Trainingstyp ist erforderlich');
    }

    if (!input.experienceLevel) {
      errors.push('Erfahrungslevel ist erforderlich');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate trainer hourly rate input
   */
  static validateTrainerHourlyRateInput(input: CreateTrainerHourlyRateInput): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!input.trainerId || input.trainerId.trim().length === 0) {
      errors.push('Trainer-ID ist erforderlich');
    }

    if (!input.trainerName || input.trainerName.trim().length < 2) {
      errors.push('Trainer-Name muss mindestens 2 Zeichen lang sein');
    }

    if (!input.baseRate || input.baseRate < 0) {
      errors.push('Basisrate muss positiv sein');
    }

    if (input.overrideRate !== undefined && input.overrideRate < 0) {
      errors.push('Override-Rate muss positiv sein');
    }

    if (!input.validFrom || !this.isValidDate(input.validFrom)) {
      errors.push('Gültig ab ist erforderlich');
    }

    if (input.validUntil && !this.isValidDate(input.validUntil)) {
      errors.push('Ungültiges Gültig bis Datum');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate date format
   */
  private static isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  // ═══ Hourly Rate Tier Operations ═══

  static async createHourlyRateTier(input: CreateHourlyRateTierInput): Promise<HourlyRateTier> {
    const validation = this.validateHourlyRateTierInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    return await this.tierRepo.create(input);
  }

  static async getHourlyRateTierById(id: string): Promise<HourlyRateTier | null> {
    return await this.tierRepo.findById(id);
  }

  static async getAllHourlyRateTiers(): Promise<HourlyRateTier[]> {
    return await this.tierRepo.findAll();
  }

  static async getActiveHourlyRateTiers(): Promise<HourlyRateTier[]> {
    return await this.tierRepo.findActive();
  }

  static async updateHourlyRateTier(
    id: string,
    input: UpdateHourlyRateTierInput
  ): Promise<HourlyRateTier | null> {
    return await this.tierRepo.update(id, input);
  }

  static async deleteHourlyRateTier(id: string): Promise<boolean> {
    return await this.tierRepo.delete(id);
  }

  // ═══ Trainer Hourly Rate Operations ═══

  static async createTrainerHourlyRate(
    input: CreateTrainerHourlyRateInput
  ): Promise<TrainerHourlyRate> {
    const validation = this.validateTrainerHourlyRateInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    return await this.trainerRateRepo.create(input);
  }

  static async getTrainerHourlyRateById(id: string): Promise<TrainerHourlyRate | null> {
    return await this.trainerRateRepo.findById(id);
  }

  static async getTrainerHourlyRateByTrainerId(
    trainerId: string
  ): Promise<TrainerHourlyRate | null> {
    return await this.trainerRateRepo.findByTrainerId(trainerId);
  }

  static async getAllTrainerHourlyRates(): Promise<TrainerHourlyRate[]> {
    return await this.trainerRateRepo.findAll();
  }

  static async updateTrainerHourlyRate(
    id: string,
    input: UpdateTrainerHourlyRateInput
  ): Promise<TrainerHourlyRate | null> {
    return await this.trainerRateRepo.update(id, input);
  }

  static async deleteTrainerHourlyRate(id: string): Promise<boolean> {
    return await this.trainerRateRepo.delete(id);
  }

  static async calculateEffectiveRate(trainerId: string): Promise<number | null> {
    return await this.trainerRateRepo.calculateEffectiveRate(trainerId);
  }

  // ═══ Rate History Operations ═══

  static async getRateHistoryForTrainer(trainerId: string): Promise<RateHistoryEntry[]> {
    return await this.historyRepo.findByTrainerId(trainerId);
  }

  static async getAllRateHistory(): Promise<RateHistoryEntry[]> {
    return await this.historyRepo.findAll();
  }
}

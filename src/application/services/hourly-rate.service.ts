import {
  HourlyRateTier,
  TrainerHourlyRate,
  RateHistoryEntry,
  CreateHourlyRateTierInput,
  UpdateHourlyRateTierInput,
  CreateTrainerHourlyRateInput,
  UpdateTrainerHourlyRateInput,
} from '../entities/hourly-rate.entity';

export class HourlyRateService {
  private static rateTiers: HourlyRateTier[] = [];
  private static trainerRates: TrainerHourlyRate[] = [];
  private static rateHistory: RateHistoryEntry[] = [];

  /**
   * Generate a unique ID
   */
  private static generateId(): string {
    return `rate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate hourly rate tier input
   */
  static validateHourlyRateTierInput(input: CreateHourlyRateTierInput): { valid: boolean; errors: string[] } {
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
  static validateTrainerHourlyRateInput(input: CreateTrainerHourlyRateInput): { valid: boolean; errors: string[] } {
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

  /**
   * Create a new hourly rate tier
   */
  static async createHourlyRateTier(input: CreateHourlyRateTierInput): Promise<HourlyRateTier> {
    const validation = this.validateHourlyRateTierInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const now = new Date().toISOString();
    const rateTier: HourlyRateTier = {
      id: this.generateId(),
      name: input.name,
      description: input.description,
      baseRate: input.baseRate,
      trainingTypes: input.trainingTypes,
      experienceLevel: input.experienceLevel,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    this.rateTiers.push(rateTier);
    return rateTier;
  }

  /**
   * Get hourly rate tier by ID
   */
  static async getHourlyRateTierById(id: string): Promise<HourlyRateTier | null> {
    return this.rateTiers.find((t) => t.id === id) || null;
  }

  /**
   * Get all hourly rate tiers
   */
  static async getAllHourlyRateTiers(): Promise<HourlyRateTier[]> {
    return [...this.rateTiers];
  }

  /**
   * Get active hourly rate tiers
   */
  static async getActiveHourlyRateTiers(): Promise<HourlyRateTier[]> {
    return this.rateTiers.filter((t) => t.isActive);
  }

  /**
   * Update hourly rate tier
   */
  static async updateHourlyRateTier(id: string, input: UpdateHourlyRateTierInput): Promise<HourlyRateTier | null> {
    const index = this.rateTiers.findIndex((t) => t.id === id);
    if (index === -1) {
      return null;
    }

    const existing = this.rateTiers[index];
    const updated: HourlyRateTier = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    this.rateTiers[index] = updated;
    return updated;
  }

  /**
   * Delete hourly rate tier
   */
  static async deleteHourlyRateTier(id: string): Promise<boolean> {
    const index = this.rateTiers.findIndex((t) => t.id === id);
    if (index === -1) {
      return false;
    }

    this.rateTiers.splice(index, 1);
    return true;
  }

  /**
   * Create a new trainer hourly rate
   */
  static async createTrainerHourlyRate(input: CreateTrainerHourlyRateInput): Promise<TrainerHourlyRate> {
    const validation = this.validateTrainerHourlyRateInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const now = new Date().toISOString();
    const effectiveRate = input.overrideRate || input.baseRate;

    const trainerRate: TrainerHourlyRate = {
      id: this.generateId(),
      trainerId: input.trainerId,
      trainerName: input.trainerName,
      baseRate: input.baseRate,
      overrideRate: input.overrideRate,
      effectiveRate,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      reason: input.reason,
      createdAt: now,
      updatedAt: now,
    };

    this.trainerRates.push(trainerRate);
    return trainerRate;
  }

  /**
   * Get trainer hourly rate by ID
   */
  static async getTrainerHourlyRateById(id: string): Promise<TrainerHourlyRate | null> {
    return this.trainerRates.find((r) => r.id === id) || null;
  }

  /**
   * Get trainer hourly rate by trainer ID
   */
  static async getTrainerHourlyRateByTrainerId(trainerId: string): Promise<TrainerHourlyRate | null> {
    const now = new Date();
    return (
      this.trainerRates.find(
        (r) =>
          r.trainerId === trainerId &&
          new Date(r.validFrom) <= now &&
          (!r.validUntil || new Date(r.validUntil) >= now)
      ) || null
    );
  }

  /**
   * Get all trainer hourly rates
   */
  static async getAllTrainerHourlyRates(): Promise<TrainerHourlyRate[]> {
    return [...this.trainerRates];
  }

  /**
   * Update trainer hourly rate
   */
  static async updateTrainerHourlyRate(id: string, input: UpdateTrainerHourlyRateInput): Promise<TrainerHourlyRate | null> {
    const index = this.trainerRates.findIndex((r) => r.id === id);
    if (index === -1) {
      return null;
    }

    const existing = this.trainerRates[index];
    const oldRate = existing.effectiveRate;

    const updated: TrainerHourlyRate = {
      ...existing,
      ...input,
      effectiveRate: input.overrideRate || existing.baseRate,
      updatedAt: new Date().toISOString(),
    };

    this.trainerRates[index] = updated;

    // Add to history if rate changed
    if (updated.effectiveRate !== oldRate) {
      this.rateHistory.push({
        id: this.generateId(),
        trainerId: existing.trainerId,
        trainerName: existing.trainerName,
        oldRate,
        newRate: updated.effectiveRate,
        changedAt: new Date().toISOString(),
        changedBy: 'Admin',
        reason: input.reason,
      });
    }

    return updated;
  }

  /**
   * Delete trainer hourly rate
   */
  static async deleteTrainerHourlyRate(id: string): Promise<boolean> {
    const index = this.trainerRates.findIndex((r) => r.id === id);
    if (index === -1) {
      return false;
    }

    this.trainerRates.splice(index, 1);
    return true;
  }

  /**
   * Get rate history for a trainer
   */
  static async getRateHistoryForTrainer(trainerId: string): Promise<RateHistoryEntry[]> {
    return this.rateHistory.filter((h) => h.trainerId === trainerId);
  }

  /**
   * Get all rate history
   */
  static async getAllRateHistory(): Promise<RateHistoryEntry[]> {
    return [...this.rateHistory];
  }

  /**
   * Calculate effective rate for a trainer
   */
  static async calculateEffectiveRate(trainerId: string): Promise<number | null> {
    const trainerRate = await this.getTrainerHourlyRateByTrainerId(trainerId);
    return trainerRate ? trainerRate.effectiveRate : null;
  }

  /**
   * Initialize with mock data (for development)
   */
  static initializeMockData(): void {
    const now = new Date();
    
    this.rateTiers = [
      {
        id: 'tier-1',
        name: 'Anfänger-Training',
        description: 'Stundensatz für Anfänger-Training',
        baseRate: 35,
        trainingTypes: ['Einzeltraining', 'Gruppentraining'],
        experienceLevel: 'beginner',
        isActive: true,
        createdAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'tier-2',
        name: 'Fortgeschrittenen-Training',
        description: 'Stundensatz für Fortgeschrittenen-Training',
        baseRate: 45,
        trainingTypes: ['Einzeltraining', 'Gruppentraining'],
        experienceLevel: 'intermediate',
        isActive: true,
        createdAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'tier-3',
        name: 'Wettkampf-Training',
        description: 'Stundensatz für Wettkampf-Training',
        baseRate: 55,
        trainingTypes: ['Einzeltraining', 'Mentaltraining'],
        experienceLevel: 'advanced',
        isActive: true,
        createdAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'tier-4',
        name: 'Professionelles Training',
        description: 'Stundensatz für professionelles Training',
        baseRate: 75,
        trainingTypes: ['Einzeltraining', 'Wettkampfvorbereitung'],
        experienceLevel: 'professional',
        isActive: true,
        createdAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    this.trainerRates = [
      {
        id: 'trainer-rate-1',
        trainerId: 'trainer-1',
        trainerName: 'Thomas Müller',
        baseRate: 45,
        overrideRate: 50,
        effectiveRate: 50,
        validFrom: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        reason: 'Erfahrung und Spezialisierung',
        createdAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'trainer-rate-2',
        trainerId: 'trainer-2',
        trainerName: 'Julia Weber',
        baseRate: 55,
        effectiveRate: 55,
        validFrom: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        reason: 'Professionelle Erfahrung',
        createdAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    this.rateHistory = [
      {
        id: 'history-1',
        trainerId: 'trainer-1',
        trainerName: 'Thomas Müller',
        oldRate: 45,
        newRate: 50,
        changedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        changedBy: 'Admin',
        reason: 'Erfahrung und Spezialisierung',
      },
    ];
  }
}

// Initialize mock data
HourlyRateService.initializeMockData();

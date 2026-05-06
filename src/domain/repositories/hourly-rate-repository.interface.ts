import type {
  HourlyRateTier,
  TrainerHourlyRate,
  RateHistoryEntry,
  CreateHourlyRateTierInput,
  UpdateHourlyRateTierInput,
  CreateTrainerHourlyRateInput,
  UpdateTrainerHourlyRateInput,
} from '../entities/hourly-rate.entity';

/**
 * Repository for HourlyRateTier management
 */
export interface IHourlyRateTierRepository {
  /**
   * Create a new hourly rate tier
   */
  create(input: CreateHourlyRateTierInput): Promise<HourlyRateTier>;

  /**
   * Find hourly rate tier by ID
   */
  findById(id: string): Promise<HourlyRateTier | null>;

  /**
   * Find all hourly rate tiers
   */
  findAll(): Promise<HourlyRateTier[]>;

  /**
   * Find all active hourly rate tiers
   */
  findActive(): Promise<HourlyRateTier[]>;

  /**
   * Find hourly rate tiers by club ID (multi-tenant)
   */
  findByClubId(clubId: string): Promise<HourlyRateTier[]>;

  /**
   * Update hourly rate tier
   */
  update(id: string, input: UpdateHourlyRateTierInput): Promise<HourlyRateTier | null>;

  /**
   * Delete hourly rate tier
   */
  delete(id: string): Promise<boolean>;
}

/**
 * Repository for TrainerHourlyRate management
 */
export interface ITrainerHourlyRateRepository {
  /**
   * Create a new trainer hourly rate
   */
  create(input: CreateTrainerHourlyRateInput): Promise<TrainerHourlyRate>;

  /**
   * Find trainer hourly rate by ID
   */
  findById(id: string): Promise<TrainerHourlyRate | null>;

  /**
   * Find trainer hourly rate by trainer ID (current/valid rate)
   */
  findByTrainerId(trainerId: string): Promise<TrainerHourlyRate | null>;

  /**
   * Find all trainer hourly rates
   */
  findAll(): Promise<TrainerHourlyRate[]>;

  /**
   * Find all trainer hourly rates by club ID
   */
  findByClubId(clubId: string): Promise<TrainerHourlyRate[]>;

  /**
   * Update trainer hourly rate
   */
  update(id: string, input: UpdateTrainerHourlyRateInput): Promise<TrainerHourlyRate | null>;

  /**
   * Delete trainer hourly rate
   */
  delete(id: string): Promise<boolean>;

  /**
   * Calculate effective rate for a trainer
   */
  calculateEffectiveRate(trainerId: string): Promise<number | null>;
}

/**
 * Repository for RateHistory management
 */
export interface IRateHistoryRepository {
  /**
   * Add rate change to history
   */
  addEntry(entry: Omit<RateHistoryEntry, 'id' | 'changedAt'>): Promise<RateHistoryEntry>;

  /**
   * Find rate history by trainer ID
   */
  findByTrainerId(trainerId: string): Promise<RateHistoryEntry[]>;

  /**
   * Find all rate history
   */
  findAll(): Promise<RateHistoryEntry[]>;

  /**
   * Find rate history by club ID
   */
  findByClubId(clubId: string): Promise<RateHistoryEntry[]>;
}

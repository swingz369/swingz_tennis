import type {
  TrainerProfile,
  CreateTrainerProfileInput,
  UpdateTrainerProfileInput,
  TrainerQualification,
} from '../entities/trainer.entity';

export interface ITrainerProfileRepository {
  /**
   * Create a new trainer profile
   */
  create(input: CreateTrainerProfileInput): Promise<TrainerProfile>;

  /**
   * Find trainer profile by ID
   */
  findById(id: string): Promise<TrainerProfile | null>;

  /**
   * Find trainer profile by user ID
   */
  findByUserId(userId: string): Promise<TrainerProfile | null>;

  /**
   * Find all trainer profiles
   */
  findAll(): Promise<TrainerProfile[]>;

  /**
   * Find trainer profiles by club ID (multi-tenant)
   */
  findByClubId(clubId: string): Promise<TrainerProfile[]>;

  /**
   * Find trainer profiles by status
   */
  findByStatus(status: TrainerProfile['status']): Promise<TrainerProfile[]>;

  /**
   * Find active trainers
   */
  findActiveTrainers(): Promise<TrainerProfile[]>;

  /**
   * Find active trainers by club ID
   */
  findActiveTrainersByClubId(clubId: string): Promise<TrainerProfile[]>;

  /**
   * Update trainer profile
   */
  update(id: string, input: UpdateTrainerProfileInput): Promise<TrainerProfile | null>;

  /**
   * Update trainer status
   */
  updateStatus(id: string, status: TrainerProfile['status']): Promise<TrainerProfile | null>;

  /**
   * Add qualification to trainer profile
   */
  addQualification(
    trainerId: string,
    qualification: Omit<TrainerQualification, 'id' | 'verified' | 'verifiedAt' | 'verifiedBy'>
  ): Promise<TrainerProfile | null>;

  /**
   * Verify qualification
   */
  verifyQualification(
    trainerId: string,
    qualificationId: string,
    verifiedBy: string
  ): Promise<TrainerProfile | null>;

  /**
   * Delete trainer profile
   */
  delete(id: string): Promise<boolean>;

  /**
   * Search trainer profiles
   */
  search(query: string, clubId?: string): Promise<TrainerProfile[]>;
}

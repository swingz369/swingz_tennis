/**
 * Trainer Profile Service Adapter
 *
 * Drizzle-based trainer profile operations with multi-tenant support.
 *
 * Usage:
 * ```typescript
 * import { trainerProfileService } from '@/application/services/trainer-profile-service.adapter';
 *
 * const trainers = await trainerProfileService.getAllTrainerProfiles();
 * ```
 */

import type {
  TrainerProfile,
  CreateTrainerProfileInput,
  UpdateTrainerProfileInput,
} from '@/domain/entities/trainer.entity';
import { TrainerProfileService } from './trainer-profile.service';
import { TrainerProfileRepository } from '@/infrastructure/persistence/repositories/trainer-profile.repository';


class TrainerProfileServiceAdapter {
  private trainerProfileRepo = new TrainerProfileRepository();

  /**
   * Validate trainer profile input
   */
  validateTrainerProfileInput(input: CreateTrainerProfileInput): {
    valid: boolean;
    errors: string[];
  } {
    return TrainerProfileService.validateTrainerProfileInput(input);
  }

  /**
   * Create a new trainer profile
   */
  async createTrainerProfile(input: CreateTrainerProfileInput): Promise<TrainerProfile> {
    const validation = this.validateTrainerProfileInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    return this.trainerProfileRepo.create(input);
  }

  /**
   * Get trainer profile by ID
   */
  async getTrainerProfileById(id: string): Promise<TrainerProfile | null> {
    return this.trainerProfileRepo.findById(id);
  }

  /**
   * Get trainer profile by user ID
   */
  async getTrainerProfileByUserId(userId: string): Promise<TrainerProfile | null> {
    return this.trainerProfileRepo.findByUserId(userId);
  }

  /**
   * Get all trainer profiles
   */
  async getAllTrainerProfiles(): Promise<TrainerProfile[]> {
    return this.trainerProfileRepo.findAll();
  }

  /**
   * Get trainer profiles by club ID (multi-tenant)
   */
  async getTrainerProfilesByClubId(clubId: string): Promise<TrainerProfile[]> {
    return this.trainerProfileRepo.findByClubId(clubId);
  }

  /**
   * Get trainer profiles by status
   */
  async getTrainerProfilesByStatus(
    status: TrainerProfile['status']
  ): Promise<TrainerProfile[]> {
    return this.trainerProfileRepo.findByStatus(status);
  }

  /**
   * Get active trainers
   */
  async getActiveTrainers(): Promise<TrainerProfile[]> {
    return this.trainerProfileRepo.findActiveTrainers();
  }

  /**
   * Get active trainers by club ID
   */
  async getActiveTrainersByClubId(clubId: string): Promise<TrainerProfile[]> {
    return this.trainerProfileRepo.findActiveTrainersByClubId(clubId);
  }

  /**
   * Update trainer profile
   */
  async updateTrainerProfile(
    id: string,
    input: UpdateTrainerProfileInput
  ): Promise<TrainerProfile | null> {
    return this.trainerProfileRepo.update(id, input);
  }

  /**
   * Update trainer status
   */
  async updateTrainerStatus(
    id: string,
    status: TrainerProfile['status']
  ): Promise<TrainerProfile | null> {
    return this.trainerProfileRepo.updateStatus(id, status);
  }

  /**
   * Add qualification to trainer profile
   */
  async addQualification(
    id: string,
    qualification: Omit<
      TrainerProfile['qualifications'][0],
      'id' | 'verified' | 'verifiedAt' | 'verifiedBy'
    >
  ): Promise<TrainerProfile | null> {
    return this.trainerProfileRepo.addQualification(id, qualification);
  }

  /**
   * Verify qualification
   */
  async verifyQualification(
    trainerId: string,
    qualificationId: string,
    verifiedBy: string
  ): Promise<TrainerProfile | null> {
    return this.trainerProfileRepo.verifyQualification(trainerId, qualificationId, verifiedBy);
  }

  /**
   * Delete trainer profile
   */
  async deleteTrainerProfile(id: string): Promise<boolean> {
    return this.trainerProfileRepo.delete(id);
  }

  /**
   * Search trainer profiles
   */
  async searchTrainerProfiles(query: string, clubId?: string): Promise<TrainerProfile[]> {
    return this.trainerProfileRepo.search(query, clubId);
  }
}

// Export singleton instance
export const trainerProfileService = new TrainerProfileServiceAdapter();

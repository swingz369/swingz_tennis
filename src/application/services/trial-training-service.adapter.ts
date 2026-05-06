/**
 * Trial Training Service Adapter
 *
 * Provides a unified interface for trial training operations,
 * switching between in-memory (legacy) and repository pattern (new) based on feature flags.
 *
 * Usage:
 * ```typescript
 * import { trialTrainingService } from '@/application/services/trial-training-service.adapter';
 *
 * const sessions = await trialTrainingService.getAllTrialTrainings('club-id-123');
 * ```
 */

import type {
  TrialTraining,
  CreateTrialTrainingInput,
  UpdateTrialTrainingInput,
  TrialTrainingStats,
} from '@/domain/entities/trial-training.entity';
import { TrialTrainingService } from './trial-training.service';
import { DrizzleTrialTrainingRepository } from '@/infrastructure/persistence/repositories/trial-training.repository';
import { FeatureFlags } from '@/lib/features/feature-flags';

class TrialTrainingServiceAdapter {
  private trialTrainingRepo = new DrizzleTrialTrainingRepository();

  /**
   * Validate trial training input
   * Delegates to in-memory service for validation logic
   */
  validateTrialTrainingInput(input: CreateTrialTrainingInput): {
    valid: boolean;
    errors: string[];
  } {
    return TrialTrainingService.validateTrialTrainingInput(input);
  }

  /**
   * Create a new trial training session
   */
  async createTrialTraining(
    input: CreateTrialTrainingInput,
    clubId: string
  ): Promise<TrialTraining> {
    // Always validate
    const validation = this.validateTrialTrainingInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    if (FeatureFlags.USE_TRIAL_TRAINING_REPOSITORY) {
      return this.trialTrainingRepo.create(input, clubId);
    }
    return TrialTrainingService.createTrialTraining(input);
  }

  /**
   * Get trial training by ID
   */
  async getTrialTrainingById(id: string, clubId: string): Promise<TrialTraining | null> {
    if (FeatureFlags.USE_TRIAL_TRAINING_REPOSITORY) {
      return this.trialTrainingRepo.findById(id, clubId);
    }
    return TrialTrainingService.getTrialTrainingById(id);
  }

  /**
   * Get all trial trainings
   */
  async getAllTrialTrainings(clubId: string): Promise<TrialTraining[]> {
    if (FeatureFlags.USE_TRIAL_TRAINING_REPOSITORY) {
      return this.trialTrainingRepo.findAll(clubId);
    }
    return TrialTrainingService.getAllTrialTrainings();
  }

  /**
   * Get trial trainings by status
   */
  async getTrialTrainingsByStatus(
    status: TrialTraining['status'],
    clubId: string
  ): Promise<TrialTraining[]> {
    if (FeatureFlags.USE_TRIAL_TRAINING_REPOSITORY) {
      return this.trialTrainingRepo.findByStatus(status, clubId);
    }
    return TrialTrainingService.getTrialTrainingsByStatus(status);
  }

  /**
   * Get trial trainings by participant email
   */
  async getTrialTrainingsByParticipantEmail(
    email: string,
    clubId: string
  ): Promise<TrialTraining[]> {
    if (FeatureFlags.USE_TRIAL_TRAINING_REPOSITORY) {
      return this.trialTrainingRepo.findByParticipantEmail(email, clubId);
    }
    return TrialTrainingService.getTrialTrainingsByParticipantEmail(email);
  }

  /**
   * Get upcoming trial trainings
   */
  async getUpcomingTrialTrainings(clubId: string, days: number = 7): Promise<TrialTraining[]> {
    if (FeatureFlags.USE_TRIAL_TRAINING_REPOSITORY) {
      return this.trialTrainingRepo.findUpcoming(clubId, days);
    }
    return TrialTrainingService.getUpcomingTrialTrainings(days);
  }

  /**
   * Get trial trainings needing reminder
   */
  async getTrialTrainingsNeedingReminder(clubId: string): Promise<TrialTraining[]> {
    if (FeatureFlags.USE_TRIAL_TRAINING_REPOSITORY) {
      return this.trialTrainingRepo.findUpcoming(clubId, 1); // Next 24 hours
    }
    return TrialTrainingService.getTrialTrainingsNeedingReminder();
  }

  /**
   * Search trial trainings
   */
  async searchTrialTrainings(query: string, clubId: string): Promise<TrialTraining[]> {
    if (FeatureFlags.USE_TRIAL_TRAINING_REPOSITORY) {
      return this.trialTrainingRepo.search(query, clubId);
    }
    return TrialTrainingService.searchTrialTrainings(query);
  }

  /**
   * Get trial training statistics
   */
  async getTrialTrainingStats(
    clubId: string,
    startDate?: string,
    endDate?: string
  ): Promise<TrialTrainingStats> {
    if (FeatureFlags.USE_TRIAL_TRAINING_REPOSITORY) {
      return this.trialTrainingRepo.getStats(clubId, startDate, endDate);
    }
    return TrialTrainingService.getTrialTrainingStats();
  }

  /**
   * Update trial training
   */
  async updateTrialTraining(
    id: string,
    input: UpdateTrialTrainingInput,
    clubId: string
  ): Promise<TrialTraining | null> {
    if (FeatureFlags.USE_TRIAL_TRAINING_REPOSITORY) {
      return this.trialTrainingRepo.update(id, input, clubId);
    }
    return TrialTrainingService.updateTrialTraining(id, input);
  }

  /**
   * Update trial training status
   */
  async updateTrialTrainingStatus(
    id: string,
    status: TrialTraining['status'],
    clubId: string
  ): Promise<TrialTraining | null> {
    if (FeatureFlags.USE_TRIAL_TRAINING_REPOSITORY) {
      return this.trialTrainingRepo.updateStatus(id, status, clubId);
    }
    return TrialTrainingService.updateTrialTrainingStatus(id, status);
  }

  /**
   * Add feedback to trial training
   */
  async addTrialTrainingFeedback(
    id: string,
    feedback: TrialTraining['feedback'],
    clubId: string
  ): Promise<TrialTraining | null> {
    if (FeatureFlags.USE_TRIAL_TRAINING_REPOSITORY) {
      return this.trialTrainingRepo.update(id, { feedback }, clubId);
    }
    return TrialTrainingService.addTrialTrainingFeedback(id, feedback);
  }

  /**
   * Convert trial training to member
   */
  async convertTrialToMember(
    id: string,
    memberId: string,
    clubId: string
  ): Promise<TrialTraining | null> {
    if (FeatureFlags.USE_TRIAL_TRAINING_REPOSITORY) {
      return this.trialTrainingRepo.convertToMember(id, memberId, clubId);
    }
    return TrialTrainingService.convertTrialToMember(id, memberId);
  }

  /**
   * Delete trial training
   */
  async deleteTrialTraining(id: string, clubId: string): Promise<boolean> {
    if (FeatureFlags.USE_TRIAL_TRAINING_REPOSITORY) {
      return this.trialTrainingRepo.delete(id, clubId);
    }
    return TrialTrainingService.deleteTrialTraining(id);
  }
}

// Export singleton instance
export const trialTrainingService = new TrialTrainingServiceAdapter();

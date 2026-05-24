/**
 * Trial Training Service Adapter
 *
 * Drizzle-based trial training operations.
 *
 * Usage:
 * ```typescript
 * import { trialTrainingService } from '@/application/services/trial-training-service.adapter';
 *
 * const sessions = await trialTrainingService.getAllTrialTrainings();
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
    clubId: string = ''
  ): Promise<TrialTraining> {
    const validation = this.validateTrialTrainingInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    return this.trialTrainingRepo.create(input, clubId);
  }

  /**
   * Get trial training by ID
   */
  async getTrialTrainingById(id: string, clubId: string = ''): Promise<TrialTraining | null> {
    return this.trialTrainingRepo.findById(id, clubId);
  }

  /**
   * Get all trial trainings
   */
  async getAllTrialTrainings(clubId: string = ''): Promise<TrialTraining[]> {
    return this.trialTrainingRepo.findAll(clubId);
  }

  /**
   * Get trial trainings by status
   */
  async getTrialTrainingsByStatus(
    status: TrialTraining['status'],
    clubId: string = ''
  ): Promise<TrialTraining[]> {
    return this.trialTrainingRepo.findByStatus(status, clubId);
  }

  /**
   * Get trial trainings by participant email
   */
  async getTrialTrainingsByParticipantEmail(
    email: string,
    clubId: string = ''
  ): Promise<TrialTraining[]> {
    return this.trialTrainingRepo.findByParticipantEmail(email, clubId);
  }

  /**
   * Get upcoming trial trainings
   */
  async getUpcomingTrialTrainings(clubId: string = '', days: number = 7): Promise<TrialTraining[]> {
    return this.trialTrainingRepo.findUpcoming(clubId, days);
  }

  /**
   * Get trial trainings needing reminder
   */
  async getTrialTrainingsNeedingReminder(clubId: string = ''): Promise<TrialTraining[]> {
    return this.trialTrainingRepo.findUpcoming(clubId, 1);
  }

  /**
   * Search trial trainings
   */
  async searchTrialTrainings(query: string, clubId: string = ''): Promise<TrialTraining[]> {
    return this.trialTrainingRepo.search(query, clubId);
  }

  /**
   * Get trial training statistics
   */
  async getTrialTrainingStats(
    clubId: string = '',
    startDate?: string,
    endDate?: string
  ): Promise<TrialTrainingStats> {
    return this.trialTrainingRepo.getStats(clubId, startDate, endDate);
  }

  /**
   * Update trial training
   */
  async updateTrialTraining(
    id: string,
    input: UpdateTrialTrainingInput,
    clubId: string = ''
  ): Promise<TrialTraining | null> {
    return this.trialTrainingRepo.update(id, input, clubId);
  }

  /**
   * Update trial training status
   */
  async updateTrialTrainingStatus(
    id: string,
    status: TrialTraining['status'],
    clubId: string = ''
  ): Promise<TrialTraining | null> {
    return this.trialTrainingRepo.updateStatus(id, status, clubId);
  }

  /**
   * Add feedback to trial training
   */
  async addTrialTrainingFeedback(
    id: string,
    feedback: TrialTraining['feedback'],
    clubId: string = ''
  ): Promise<TrialTraining | null> {
    return this.trialTrainingRepo.update(id, { feedback }, clubId);
  }

  /**
   * Convert trial training to member
   */
  async convertTrialToMember(
    id: string,
    memberId: string,
    clubId: string = ''
  ): Promise<TrialTraining | null> {
    return this.trialTrainingRepo.convertToMember(id, memberId, clubId);
  }

  /**
   * Delete trial training
   */
  async deleteTrialTraining(id: string, clubId: string = ''): Promise<boolean> {
    return this.trialTrainingRepo.delete(id, clubId);
  }
}

// Export singleton instance
export const trialTrainingService = new TrialTrainingServiceAdapter();

import type {
  TrialTraining,
  CreateTrialTrainingInput,
  UpdateTrialTrainingInput,
  TrialTrainingStats,
} from '../entities/trial-training.entity';

/**
 * Repository interface for managing trial training sessions
 * Provides database operations with multi-tenant isolation and conversion tracking
 */
export interface ITrialTrainingRepository {
  /**
   * Create a new trial training session
   * @param input - Trial training data
   * @param clubId - Club ID for tenant isolation
   * @returns Created trial training with generated IDs
   * @throws Error if validation fails
   */
  create(input: CreateTrialTrainingInput, clubId: string): Promise<TrialTraining>;

  /**
   * Find trial training by ID
   * @param id - Trial training ID
   * @param clubId - Club ID for tenant isolation
   * @returns Trial training if found, null otherwise
   */
  findById(id: string, clubId: string): Promise<TrialTraining | null>;

  /**
   * Find all trial trainings in a club
   * @param clubId - Club ID for tenant isolation
   * @returns Array of all trial trainings
   */
  findAll(clubId: string): Promise<TrialTraining[]>;

  /**
   * Find trial trainings by status
   * @param status - Session status
   * @param clubId - Club ID for tenant isolation
   * @returns Array of trial trainings with the specified status
   */
  findByStatus(status: TrialTraining['status'], clubId: string): Promise<TrialTraining[]>;

  /**
   * Find trial trainings by participant email
   * @param email - Participant email
   * @param clubId - Club ID for tenant isolation
   * @returns Array of trial trainings for the participant
   */
  findByParticipantEmail(email: string, clubId: string): Promise<TrialTraining[]>;

  /**
   * Find trial trainings by trainer
   * @param trainerId - Trainer ID
   * @param clubId - Club ID for tenant isolation
   * @returns Array of trial trainings assigned to the trainer
   */
  findByTrainer(trainerId: string, clubId: string): Promise<TrialTraining[]>;

  /**
   * Get upcoming trial trainings (scheduled in next N days)
   * @param clubId - Club ID for tenant isolation
   * @param days - Number of days ahead (default 7)
   * @returns Array of upcoming scheduled trial trainings
   */
  findUpcoming(clubId: string, days?: number): Promise<TrialTraining[]>;

  /**
   * Search trial trainings by participant name or email
   * @param query - Search query
   * @param clubId - Club ID for tenant isolation
   * @returns Array of matching trial trainings
   */
  search(query: string, clubId: string): Promise<TrialTraining[]>;

  /**
   * Get trial training statistics
   * @param clubId - Club ID for tenant isolation
   * @param startDate - Optional start date filter
   * @param endDate - Optional end date filter
   * @returns Statistics including conversion rate
   */
  getStats(clubId: string, startDate?: string, endDate?: string): Promise<TrialTrainingStats>;

  /**
   * Update a trial training
   * @param id - Trial training ID
   * @param input - Partial trial training data to update
   * @param clubId - Club ID for tenant isolation
   * @returns Updated trial training if found, null otherwise
   */
  update(
    id: string,
    input: UpdateTrialTrainingInput,
    clubId: string
  ): Promise<TrialTraining | null>;

  /**
   * Update trial training status
   * @param id - Trial training ID
   * @param status - New status
   * @param clubId - Club ID for tenant isolation
   * @returns Updated trial training if found, null otherwise
   */
  updateStatus(
    id: string,
    status: TrialTraining['status'],
    clubId: string
  ): Promise<TrialTraining | null>;

  /**
   * Convert trial training to member
   * @param id - Trial training ID
   * @param memberId - Member ID after conversion
   * @param clubId - Club ID for tenant isolation
   * @returns Updated trial training if found, null otherwise
   */
  convertToMember(id: string, memberId: string, clubId: string): Promise<TrialTraining | null>;

  /**
   * Delete a trial training
   * @param id - Trial training ID
   * @param clubId - Club ID for tenant isolation
   * @returns true if deleted, false if not found
   */
  delete(id: string, clubId: string): Promise<boolean>;
}

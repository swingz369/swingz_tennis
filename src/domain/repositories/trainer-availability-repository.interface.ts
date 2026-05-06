// Export types for use in implementations
export type {
  TrainerAvailability,
  AvailabilityConflict,
  CreateTrainerAvailabilityInput,
  UpdateTrainerAvailabilityInput,
  AvailabilityQuery,
} from '../entities/trainer-availability.entity';

/**
 * Repository interface for trainer availability (time slots when trainers are available)
 */
export interface TrainerAvailabilityRepository {
  /**
   * Create a new availability slot
   */
  create(input: CreateTrainerAvailabilityInput): Promise<TrainerAvailability>;

  /**
   * Find availability by ID
   */
  findById(id: string): Promise<TrainerAvailability | null>;

  /**
   * Find availabilities by trainer ID
   */
  findByTrainerId(trainerId: string): Promise<TrainerAvailability[]>;

  /**
   * Find all availabilities
   */
  findAll(): Promise<TrainerAvailability[]>;

  /**
   * Find availabilities by query filters
   */
  findByQuery(query: AvailabilityQuery): Promise<TrainerAvailability[]>;

  /**
   * Find availabilities by date range
   */
  findByDateRange(
    trainerId: string,
    startDate: string,
    endDate: string
  ): Promise<TrainerAvailability[]>;

  /**
   * Find availabilities by status
   */
  findByStatus(
    trainerId: string,
    status: TrainerAvailability['status']
  ): Promise<TrainerAvailability[]>;

  /**
   * Update an availability
   */
  update(id: string, input: UpdateTrainerAvailabilityInput): Promise<TrainerAvailability | null>;

  /**
   * Mark an availability as booked
   */
  markAsBooked(id: string): Promise<TrainerAvailability | null>;

  /**
   * Mark an availability as blocked
   */
  markAsBlocked(id: string, notes?: string): Promise<TrainerAvailability | null>;

  /**
   * Delete an availability
   */
  delete(id: string): Promise<void>;

  /**
   * Check for time conflicts
   */
  checkForConflicts(
    trainerId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeId?: string
  ): Promise<AvailabilityConflict[]>;

  /**
   * Get available time slots for a trainer on a specific date
   */
  getAvailableSlots(trainerId: string, date: string): Promise<TrainerAvailability[]>;
}

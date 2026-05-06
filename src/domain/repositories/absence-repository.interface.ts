import type { Absence, CreateAbsenceInput, UpdateAbsenceInput } from '../entities/absence.entity';

/**
 * Repository interface for managing trainer absences
 * Provides database operations with multi-tenant isolation and approval workflow
 */
export interface IAbsenceRepository {
  /**
   * Create a new absence request
   * @param input - Absence data including trainer, dates, and reason
   * @param clubId - Club ID for tenant isolation
   * @returns Created absence with generated ID
   * @throws Error if validation fails or conflicts exist
   */
  create(input: CreateAbsenceInput, clubId: string): Promise<Absence>;

  /**
   * Find absence by ID
   * @param id - Absence ID
   * @param clubId - Club ID for tenant isolation
   * @returns Absence if found, null otherwise
   */
  findById(id: string, clubId: string): Promise<Absence | null>;

  /**
   * Find all absences for a specific trainer
   * @param trainerId - Trainer ID
   * @param clubId - Club ID for tenant isolation
   * @returns Array of absences for the trainer
   */
  findByTrainerId(trainerId: string, clubId: string): Promise<Absence[]>;

  /**
   * Find all absences in a club
   * @param clubId - Club ID for tenant isolation
   * @returns Array of all absences in the club
   */
  findAll(clubId: string): Promise<Absence[]>;

  /**
   * Find absences by status
   * @param status - Absence status (pending, approved, rejected)
   * @param clubId - Club ID for tenant isolation
   * @returns Array of absences with the specified status
   */
  findByStatus(status: Absence['status'], clubId: string): Promise<Absence[]>;

  /**
   * Find absences by type
   * @param type - Absence type (sick, vacation, personal, other)
   * @param clubId - Club ID for tenant isolation
   * @returns Array of absences with the specified type
   */
  findByType(type: Absence['type'], clubId: string): Promise<Absence[]>;

  /**
   * Find absences within a date range
   * Includes any absence that overlaps with the specified range
   * @param startDate - Range start date (ISO string)
   * @param endDate - Range end date (ISO string)
   * @param clubId - Club ID for tenant isolation
   * @returns Array of absences overlapping the date range
   */
  findByDateRange(startDate: string, endDate: string, clubId: string): Promise<Absence[]>;

  /**
   * Find active (approved) absences for a specific date
   * @param date - Target date (ISO string)
   * @param clubId - Club ID for tenant isolation
   * @returns Array of approved absences active on the specified date
   */
  findActiveForDate(date: string, clubId: string): Promise<Absence[]>;

  /**
   * Check for overlapping absences for a trainer
   * Used for conflict detection before creating/updating absences
   * @param trainerId - Trainer ID
   * @param startDate - Absence start date (ISO string)
   * @param endDate - Absence end date (ISO string)
   * @param clubId - Club ID for tenant isolation
   * @param excludeId - Optional absence ID to exclude (for updates)
   * @returns Array of conflicting absences
   */
  findConflicting(
    trainerId: string,
    startDate: string,
    endDate: string,
    clubId: string,
    excludeId?: string
  ): Promise<Absence[]>;

  /**
   * Update an existing absence
   * @param id - Absence ID
   * @param input - Partial absence data to update
   * @param clubId - Club ID for tenant isolation
   * @returns Updated absence if found, null otherwise
   * @throws Error if validation fails or conflicts exist
   */
  update(id: string, input: UpdateAbsenceInput, clubId: string): Promise<Absence | null>;

  /**
   * Approve an absence request
   * @param id - Absence ID
   * @param approvedBy - User ID of approver
   * @param clubId - Club ID for tenant isolation
   * @returns Approved absence if found, null otherwise
   */
  approve(id: string, approvedBy: string, clubId: string): Promise<Absence | null>;

  /**
   * Reject an absence request
   * @param id - Absence ID
   * @param approvedBy - User ID of rejector
   * @param clubId - Club ID for tenant isolation
   * @returns Rejected absence if found, null otherwise
   */
  reject(id: string, approvedBy: string, clubId: string): Promise<Absence | null>;

  /**
   * Delete an absence
   * @param id - Absence ID
   * @param clubId - Club ID for tenant isolation
   * @returns true if deleted, false if not found
   */
  delete(id: string, clubId: string): Promise<boolean>;
}

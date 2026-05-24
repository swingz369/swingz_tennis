/**
 * Absence Service Adapter
 *
 * Drizzle-based absence operations.
 *
 * Usage:
 * ```typescript
 * import { absenceService } from '@/application/services/absence-service.adapter';
 *
 * const absences = await absenceService.getAllAbsences();
 * ```
 */

import type {
  Absence,
  CreateAbsenceInput,
  UpdateAbsenceInput,
  AbsenceConflict,
} from '@/domain/entities/absence.entity';
import { AbsenceService } from './absence.service';
import { DrizzleAbsenceRepository } from '@/infrastructure/persistence/repositories/absence.repository';

class AbsenceServiceAdapter {
  private absenceRepo = new DrizzleAbsenceRepository();

  /**
   * Validate absence input
   * Delegates to in-memory service for validation logic
   */
  validateAbsenceInput(input: CreateAbsenceInput): { valid: boolean; errors: string[] } {
    return AbsenceService.validateAbsenceInput(input);
  }

  /**
   * Check for conflicts with existing absences
   */
  async checkForConflicts(
    trainerId: string,
    startDate: string,
    endDate: string,
    clubId: string = '',
    excludeId?: string
  ): Promise<AbsenceConflict[]> {
    const conflicting = await this.absenceRepo.findConflicting(
      trainerId,
      startDate,
      endDate,
      clubId,
      excludeId
    );

    return conflicting.map((absence) => ({
      id: `conflict-${absence.id}`,
      trainerId: absence.trainerId,
      trainerName: absence.trainerName,
      absenceId: absence.id,
      conflictType: 'availability' as const,
      conflictingDate: absence.startDate,
      conflictingWith: [absence.id],
    }));
  }

  /**
   * Create a new absence request
   */
  async createAbsence(input: CreateAbsenceInput, clubId: string = ''): Promise<Absence> {
    const validation = this.validateAbsenceInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Check for conflicts
    const conflicts = await this.checkForConflicts(
      input.trainerId,
      input.startDate,
      input.endDate,
      clubId
    );

    if (conflicts.length > 0) {
      throw new Error(`Conflicts detected: ${conflicts.map((c) => c.conflictType).join(', ')}`);
    }

    return this.absenceRepo.create(input, clubId);
  }

  /**
   * Get absence by ID
   */
  async getAbsenceById(id: string, clubId: string = ''): Promise<Absence | null> {
    return this.absenceRepo.findById(id, clubId);
  }

  /**
   * Get absences by trainer ID
   */
  async getAbsencesByTrainerId(trainerId: string, clubId: string = ''): Promise<Absence[]> {
    return this.absenceRepo.findByTrainerId(trainerId, clubId);
  }

  /**
   * Get all absences
   */
  async getAllAbsences(clubId: string = ''): Promise<Absence[]> {
    return this.absenceRepo.findAll(clubId);
  }

  /**
   * Get absences by status
   */
  async getAbsencesByStatus(status: Absence['status'], clubId: string = ''): Promise<Absence[]> {
    return this.absenceRepo.findByStatus(status, clubId);
  }

  /**
   * Get absences by type
   */
  async getAbsencesByType(type: Absence['type'], clubId: string = ''): Promise<Absence[]> {
    return this.absenceRepo.findByType(type, clubId);
  }

  /**
   * Get absences by date range
   */
  async getAbsencesByDateRange(
    startDate: string,
    endDate: string,
    clubId: string = ''
  ): Promise<Absence[]> {
    return this.absenceRepo.findByDateRange(startDate, endDate, clubId);
  }

  /**
   * Get active absences for a specific date
   */
  async getActiveAbsencesForDate(date: string, clubId: string = ''): Promise<Absence[]> {
    return this.absenceRepo.findActiveForDate(date, clubId);
  }

  /**
   * Update an absence
   */
  async updateAbsence(
    id: string,
    input: UpdateAbsenceInput,
    clubId: string = ''
  ): Promise<Absence | null> {
    // Check for conflicts if dates are changing
    if ((input.startDate || input.endDate) && input.status !== 'rejected') {
      // Get existing absence to determine new dates
      const existing = await this.getAbsenceById(id, clubId);
      if (!existing) {
        return null;
      }

      const newStart = input.startDate || existing.startDate;
      const newEnd = input.endDate || existing.endDate;

      const conflicts = await this.checkForConflicts(
        existing.trainerId,
        newStart,
        newEnd,
        clubId,
        id
      );

      if (conflicts.length > 0) {
        throw new Error(`Conflicts detected: ${conflicts.map((c) => c.conflictType).join(', ')}`);
      }
    }

    return this.absenceRepo.update(id, input, clubId);
  }

  /**
   * Approve an absence request
   */
  async approveAbsence(
    id: string,
    approvedBy: string,
    clubId: string = ''
  ): Promise<Absence | null> {
    return this.absenceRepo.approve(id, approvedBy, clubId);
  }

  /**
   * Reject an absence request
   */
  async rejectAbsence(
    id: string,
    approvedBy: string,
    clubId: string = ''
  ): Promise<Absence | null> {
    return this.absenceRepo.reject(id, approvedBy, clubId);
  }

  /**
   * Delete an absence
   */
  async deleteAbsence(id: string, clubId: string = ''): Promise<boolean> {
    return this.absenceRepo.delete(id, clubId);
  }
}

// Export singleton instance
export const absenceService = new AbsenceServiceAdapter();

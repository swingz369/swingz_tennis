/**
 * Absence Service Adapter
 *
 * Provides a unified interface for absence operations,
 * switching between in-memory (legacy) and repository pattern (new) based on feature flags.
 *
 * Usage:
 * ```typescript
 * import { absenceService } from '@/application/services/absence-service.adapter';
 *
 * const absences = await absenceService.getAllAbsences('club-id-123');
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
import { FeatureFlags } from '@/lib/features/feature-flags';

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
    clubId: string,
    excludeId?: string
  ): Promise<AbsenceConflict[]> {
    if (FeatureFlags.USE_ABSENCE_REPOSITORY) {
      // Use repository to find conflicting absences
      const conflicts = await this.absenceRepo.findConflicting(
        trainerId,
        startDate,
        endDate,
        clubId,
        excludeId
      );

      // Map to AbsenceConflict format
      return conflicts.map((absence) => ({
        id: `conflict-${absence.id}`,
        trainerId: absence.trainerId,
        trainerName: absence.trainerName,
        absenceId: absence.id,
        conflictType: 'availability' as const,
        conflictingDate: absence.startDate,
        conflictingWith: [absence.id],
      }));
    }
    return AbsenceService.checkForConflicts(trainerId, startDate, endDate, excludeId);
  }

  /**
   * Create a new absence request
   */
  async createAbsence(input: CreateAbsenceInput, clubId: string): Promise<Absence> {
    // Always validate
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

    if (FeatureFlags.USE_ABSENCE_REPOSITORY) {
      return this.absenceRepo.create(input, clubId);
    }
    return AbsenceService.createAbsence(input);
  }

  /**
   * Get absence by ID
   */
  async getAbsenceById(id: string, clubId: string): Promise<Absence | null> {
    if (FeatureFlags.USE_ABSENCE_REPOSITORY) {
      return this.absenceRepo.findById(id, clubId);
    }
    return AbsenceService.getAbsenceById(id);
  }

  /**
   * Get absences by trainer ID
   */
  async getAbsencesByTrainerId(trainerId: string, clubId: string): Promise<Absence[]> {
    if (FeatureFlags.USE_ABSENCE_REPOSITORY) {
      return this.absenceRepo.findByTrainerId(trainerId, clubId);
    }
    return AbsenceService.getAbsencesByTrainerId(trainerId);
  }

  /**
   * Get all absences
   */
  async getAllAbsences(clubId: string): Promise<Absence[]> {
    if (FeatureFlags.USE_ABSENCE_REPOSITORY) {
      return this.absenceRepo.findAll(clubId);
    }
    return AbsenceService.getAllAbsences();
  }

  /**
   * Get absences by status
   */
  async getAbsencesByStatus(status: Absence['status'], clubId: string): Promise<Absence[]> {
    if (FeatureFlags.USE_ABSENCE_REPOSITORY) {
      return this.absenceRepo.findByStatus(status, clubId);
    }
    return AbsenceService.getAbsencesByStatus(status);
  }

  /**
   * Get absences by type
   */
  async getAbsencesByType(type: Absence['type'], clubId: string): Promise<Absence[]> {
    if (FeatureFlags.USE_ABSENCE_REPOSITORY) {
      return this.absenceRepo.findByType(type, clubId);
    }
    return AbsenceService.getAbsencesByType(type);
  }

  /**
   * Get absences by date range
   */
  async getAbsencesByDateRange(
    startDate: string,
    endDate: string,
    clubId: string
  ): Promise<Absence[]> {
    if (FeatureFlags.USE_ABSENCE_REPOSITORY) {
      return this.absenceRepo.findByDateRange(startDate, endDate, clubId);
    }
    return AbsenceService.getAbsencesByDateRange(startDate, endDate);
  }

  /**
   * Get active absences for a specific date
   */
  async getActiveAbsencesForDate(date: string, clubId: string): Promise<Absence[]> {
    if (FeatureFlags.USE_ABSENCE_REPOSITORY) {
      return this.absenceRepo.findActiveForDate(date, clubId);
    }
    return AbsenceService.getActiveAbsencesForDate(date);
  }

  /**
   * Update an absence
   */
  async updateAbsence(
    id: string,
    input: UpdateAbsenceInput,
    clubId: string
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

    if (FeatureFlags.USE_ABSENCE_REPOSITORY) {
      return this.absenceRepo.update(id, input, clubId);
    }
    return AbsenceService.updateAbsence(id, input);
  }

  /**
   * Approve an absence request
   */
  async approveAbsence(id: string, approvedBy: string, clubId: string): Promise<Absence | null> {
    if (FeatureFlags.USE_ABSENCE_REPOSITORY) {
      return this.absenceRepo.approve(id, approvedBy, clubId);
    }
    return AbsenceService.approveAbsence(id, approvedBy);
  }

  /**
   * Reject an absence request
   */
  async rejectAbsence(id: string, approvedBy: string, clubId: string): Promise<Absence | null> {
    if (FeatureFlags.USE_ABSENCE_REPOSITORY) {
      return this.absenceRepo.reject(id, approvedBy, clubId);
    }
    return AbsenceService.rejectAbsence(id, approvedBy);
  }

  /**
   * Delete an absence
   */
  async deleteAbsence(id: string, clubId: string): Promise<boolean> {
    if (FeatureFlags.USE_ABSENCE_REPOSITORY) {
      return this.absenceRepo.delete(id, clubId);
    }
    return AbsenceService.deleteAbsence(id);
  }
}

// Export singleton instance
export const absenceService = new AbsenceServiceAdapter();

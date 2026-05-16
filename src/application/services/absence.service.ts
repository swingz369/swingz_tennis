import type {
  Absence,
  CreateAbsenceInput,
  UpdateAbsenceInput,
  AbsenceConflict,
} from '../../domain/entities/absence.entity';

export class AbsenceService {
  private static absences: Absence[] = [];

  /**
   * Generate a unique ID
   */
  private static generateId(): string {
    return `absence-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate absence input
   */
  static validateAbsenceInput(input: CreateAbsenceInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.trainerId || input.trainerId.trim().length === 0) {
      errors.push('Trainer-ID ist erforderlich');
    }

    if (!input.trainerName || input.trainerName.trim().length < 2) {
      errors.push('Trainer-Name muss mindestens 2 Zeichen lang sein');
    }

    if (!input.type) {
      errors.push('Typ ist erforderlich');
    }

    if (!input.startDate || !this.isValidDate(input.startDate)) {
      errors.push('Ungültiges Startdatum');
    }

    if (!input.endDate || !this.isValidDate(input.endDate)) {
      errors.push('Ungültiges Enddatum');
    }

    if (input.startDate && input.endDate && new Date(input.startDate) > new Date(input.endDate)) {
      errors.push('Startdatum muss vor Enddatum liegen');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate date format
   */
  private static isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  /**
   * Check for conflicts with scheduled sessions
   */
  static async checkForConflicts(
    trainerId: string,
    startDate: string,
    endDate: string,
    excludeId?: string
  ): Promise<AbsenceConflict[]> {
    const conflicts: AbsenceConflict[] = [];

    // Get all absences for this trainer
    const existingAbsences = this.absences.filter(
      (a) => a.trainerId === trainerId && a.id !== excludeId && a.status === 'approved'
    );

    // Check for date overlaps
    for (const existing of existingAbsences) {
      if (this.hasDateOverlap(existing.startDate, existing.endDate, startDate, endDate)) {
        conflicts.push({
          id: this.generateId(),
          trainerId,
          trainerName: existing.trainerName,
          absenceId: existing.id,
          conflictType: 'availability',
          conflictingDate: existing.startDate,
          conflictingWith: [existing.id],
        });
      }
    }

    return conflicts;
  }

  /**
   * Check for date overlap
   */
  private static hasDateOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    const s1 = new Date(start1);
    const e1 = new Date(end1);
    const s2 = new Date(start2);
    const e2 = new Date(end2);

    return (s2 >= s1 && s2 <= e1) || (e2 >= s1 && e2 <= e1) || (s2 <= s1 && e2 >= e1);
  }

  /**
   * Create a new absence
   */
  static async createAbsence(input: CreateAbsenceInput): Promise<Absence> {
    const validation = this.validateAbsenceInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Check for conflicts
    const conflicts = await this.checkForConflicts(input.trainerId, input.startDate, input.endDate);

    if (conflicts.length > 0) {
      throw new Error(`Conflicts detected: ${conflicts.map((c) => c.conflictType).join(', ')}`);
    }

    const now = new Date().toISOString();
    const absence: Absence = {
      id: this.generateId(),
      trainerId: input.trainerId,
      trainerName: input.trainerName,
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'pending',
      reason: input.reason,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    this.absences.push(absence);
    return absence;
  }

  /**
   * Get absence by ID
   */
  static async getAbsenceById(id: string): Promise<Absence | null> {
    return this.absences.find((a) => a.id === id) || null;
  }

  /**
   * Get absences by trainer ID
   */
  static async getAbsencesByTrainerId(trainerId: string): Promise<Absence[]> {
    return this.absences.filter((a) => a.trainerId === trainerId);
  }

  /**
   * Get all absences
   */
  static async getAllAbsences(): Promise<Absence[]> {
    return [...this.absences];
  }

  /**
   * Get absences by status
   */
  static async getAbsencesByStatus(status: Absence['status']): Promise<Absence[]> {
    return this.absences.filter((a) => a.status === status);
  }

  /**
   * Get absences by type
   */
  static async getAbsencesByType(type: Absence['type']): Promise<Absence[]> {
    return this.absences.filter((a) => a.type === type);
  }

  /**
   * Get absences by date range
   */
  static async getAbsencesByDateRange(startDate: string, endDate: string): Promise<Absence[]> {
    return this.absences.filter((a) => {
      const absenceStart = new Date(a.startDate);
      const absenceEnd = new Date(a.endDate);
      const rangeStart = new Date(startDate);
      const rangeEnd = new Date(endDate);

      return (
        (absenceStart >= rangeStart && absenceStart <= rangeEnd) ||
        (absenceEnd >= rangeStart && absenceEnd <= rangeEnd) ||
        (absenceStart <= rangeStart && absenceEnd >= rangeEnd)
      );
    });
  }

  /**
   * Update absence
   */
  static async updateAbsence(id: string, input: UpdateAbsenceInput): Promise<Absence | null> {
    const index = this.absences.findIndex((a) => a.id === id);
    if (index === -1) {
      return null;
    }

    const existing = this.absences[index];

    // Check for conflicts if dates are changing
    if ((input.startDate || input.endDate) && input.status !== 'rejected') {
      const newStart = input.startDate || existing.startDate;
      const newEnd = input.endDate || existing.endDate;

      const conflicts = await this.checkForConflicts(existing.trainerId, newStart, newEnd, id);

      if (conflicts.length > 0) {
        throw new Error(`Conflicts detected: ${conflicts.map((c) => c.conflictType).join(', ')}`);
      }
    }

    const updated: Absence = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    this.absences[index] = updated;
    return updated;
  }

  /**
   * Approve absence
   */
  static async approveAbsence(id: string, approvedBy: string): Promise<Absence | null> {
    const updated = await this.updateAbsence(id, {
      status: 'approved',
      approvedBy,
      approvedAt: new Date().toISOString(),
    });

    return updated;
  }

  /**
   * Reject absence
   */
  static async rejectAbsence(id: string, approvedBy: string): Promise<Absence | null> {
    const updated = await this.updateAbsence(id, {
      status: 'rejected',
      approvedBy,
      approvedAt: new Date().toISOString(),
    });

    return updated;
  }

  /**
   * Delete absence
   */
  static async deleteAbsence(id: string): Promise<boolean> {
    const index = this.absences.findIndex((a) => a.id === id);
    if (index === -1) {
      return false;
    }

    this.absences.splice(index, 1);
    return true;
  }

  /**
   * Get active absences for a date
   */
  static async getActiveAbsencesForDate(date: string): Promise<Absence[]> {
    return this.absences.filter((a) => {
      if (a.status !== 'approved') {
        return false;
      }

      const absenceStart = new Date(a.startDate);
      const absenceEnd = new Date(a.endDate);
      const targetDate = new Date(date);

      return targetDate >= absenceStart && targetDate <= absenceEnd;
    });
  }

  /**
   * Initialize with mock data (for development)
   */
  static initializeMockData(): void {
    const now = new Date();

    this.absences = [
      {
        id: 'absence-1',
        trainerId: 'trainer-1',
        trainerName: 'Thomas Müller',
        type: 'vacation',
        startDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'approved',
        reason: 'Familienurlaub',
        approvedBy: 'Admin',
        approvedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'absence-2',
        trainerId: 'trainer-2',
        trainerName: 'Julia Weber',
        type: 'sick',
        startDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'approved',
        reason: 'Krankheit',
        approvedBy: 'Admin',
        approvedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
  }
}

// Initialize mock data
if (process.env.NODE_ENV !== 'production') {
  AbsenceService.initializeMockData();
}

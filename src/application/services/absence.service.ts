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
    const ds = (days: number) => new Date(now.getTime() + days * 86400000).toISOString().split('T')[0];
    const dsa = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();

    this.absences = [
      {
        id: 'absence-1', trainerId: 'trainer-1', trainerName: 'Thomas Müller', type: 'vacation',
        startDate: ds(7), endDate: ds(14), status: 'approved', reason: 'Familienurlaub',
        approvedBy: 'Admin', approvedAt: dsa(2), createdAt: dsa(5), updatedAt: dsa(2),
      },
      {
        id: 'absence-2', trainerId: 'trainer-2', trainerName: 'Julia Weber', type: 'sick',
        startDate: ds(-2), endDate: ds(1), status: 'approved', reason: 'Krankheit',
        approvedBy: 'Admin', approvedAt: dsa(2), createdAt: dsa(3), updatedAt: dsa(2),
      },
      {
        id: 'absence-3', trainerId: 'trainer-3', trainerName: 'Michael Bauer', type: 'vacation',
        startDate: ds(14), endDate: ds(21), status: 'pending', reason: 'Sommerurlaub',
        createdAt: dsa(1), updatedAt: dsa(1),
      },
      {
        id: 'absence-4', trainerId: 'trainer-1', trainerName: 'Thomas Müller', type: 'training',
        startDate: ds(30), endDate: ds(32), status: 'approved', reason: 'DTB Fortbildung München',
        approvedBy: 'Admin', approvedAt: dsa(0), createdAt: dsa(1), updatedAt: dsa(0),
      },
      {
        id: 'absence-5', trainerId: 'trainer-4', trainerName: 'Sarah Klein', type: 'sick',
        startDate: ds(-5), endDate: ds(-3), status: 'approved', reason: 'Magen-Darm-Infekt',
        approvedBy: 'Admin', approvedAt: dsa(5), createdAt: dsa(5), updatedAt: dsa(5),
      },
      {
        id: 'absence-6', trainerId: 'trainer-2', trainerName: 'Julia Weber', type: 'personal',
        startDate: ds(3), endDate: ds(3), status: 'approved', reason: 'Hochzeit Geschwister',
        approvedBy: 'Admin', approvedAt: dsa(0), createdAt: dsa(2), updatedAt: dsa(0),
      },
      {
        id: 'absence-7', trainerId: 'trainer-3', trainerName: 'Michael Bauer', type: 'other',
        startDate: ds(60), endDate: ds(65), status: 'pending', reason: 'Turnierteilnahme Berlin',
        notes: 'Eventuell Vertretung durch Julia Weber', createdAt: dsa(0), updatedAt: dsa(0),
      },
      {
        id: 'absence-8', trainerId: 'trainer-1', trainerName: 'Thomas Müller', type: 'vacation',
        startDate: ds(-20), endDate: ds(-17), status: 'approved', reason: 'Kurzurlaub',
        approvedBy: 'Admin', approvedAt: dsa(22), createdAt: dsa(25), updatedAt: dsa(22),
      },
      {
        id: 'absence-9', trainerId: 'trainer-4', trainerName: 'Sarah Klein', type: 'training',
        startDate: ds(45), endDate: ds(47), status: 'pending', reason: 'Lizenzverlängerung DTB',
        createdAt: dsa(0), updatedAt: dsa(0),
      },
      {
        id: 'absence-10', trainerId: 'trainer-2', trainerName: 'Julia Weber', type: 'sick',
        startDate: ds(-10), endDate: ds(-9), status: 'approved', reason: 'Erkältung',
        approvedBy: 'Admin', approvedAt: dsa(10), createdAt: dsa(10), updatedAt: dsa(10),
      },
    ];
  }
}

// Initialize mock data
if (process.env.NODE_ENV !== 'production') {
  AbsenceService.initializeMockData();
}

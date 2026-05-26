import type {
  TrainerAvailability,
  AvailabilityConflict,
  CreateTrainerAvailabilityInput,
  UpdateTrainerAvailabilityInput,
  AvailabilityQuery,
} from '../../domain/entities/trainer-availability.entity';

export class TrainerAvailabilityService {
  private static availabilities: TrainerAvailability[] = [];

  /**
   * Generate a unique ID
   */
  private static generateId(): string {
    return `avail-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate availability input
   */
  static validateAvailabilityInput(input: CreateTrainerAvailabilityInput): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!input.trainerId || input.trainerId.trim().length === 0) {
      errors.push('Trainer-ID ist erforderlich');
    }

    if (!input.date || !this.isValidDate(input.date)) {
      errors.push('Ungültiges Datum');
    }

    if (!input.startTime || !this.isValidTime(input.startTime)) {
      errors.push('Ungültige Startzeit');
    }

    if (!input.endTime || !this.isValidTime(input.endTime)) {
      errors.push('Ungültige Endzeit');
    }

    if (input.startTime && input.endTime && input.startTime >= input.endTime) {
      errors.push('Startzeit muss vor Endzeit liegen');
    }

    if (input.recurringPattern && input.recurringPattern.interval < 1) {
      errors.push('Intervall muss mindestens 1 sein');
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
   * Validate time format
   */
  private static isValidTime(timeString: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeString);
  }

  /**
   * Check for time overlap
   */
  private static hasTimeOverlap(
    existing: TrainerAvailability,
    newStart: string,
    newEnd: string
  ): boolean {
    return (
      (newStart >= existing.startTime && newStart < existing.endTime) ||
      (newEnd > existing.startTime && newEnd <= existing.endTime) ||
      (newStart <= existing.startTime && newEnd >= existing.endTime)
    );
  }

  /**
   * Check for conflicts
   */
  static async checkForConflicts(
    trainerId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeId?: string
  ): Promise<AvailabilityConflict[]> {
    const conflicts: AvailabilityConflict[] = [];

    const existingAvailabilities = this.availabilities.filter(
      (a) =>
        a.trainerId === trainerId &&
        a.date === date &&
        a.id !== excludeId &&
        a.status !== 'unavailable'
    );

    for (const existing of existingAvailabilities) {
      if (this.hasTimeOverlap(existing, startTime, endTime)) {
        conflicts.push({
          id: this.generateId(),
          trainerId,
          trainerName: 'Trainer', // In production, fetch trainer name
          date,
          startTime,
          endTime,
          conflictType: existing.status === 'booked' ? 'double_booking' : 'overlap',
          conflictingWith: [existing.id],
        });
      }
    }

    return conflicts;
  }

  /**
   * Create a new trainer availability
   */
  static async createTrainerAvailability(
    input: CreateTrainerAvailabilityInput
  ): Promise<TrainerAvailability> {
    const validation = this.validateAvailabilityInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Check for conflicts
    const conflicts = await this.checkForConflicts(
      input.trainerId,
      input.date,
      input.startTime,
      input.endTime
    );

    if (conflicts.length > 0 && input.status !== 'unavailable') {
      throw new Error(`Conflicts detected: ${conflicts.map((c) => c.conflictType).join(', ')}`);
    }

    const now = new Date().toISOString();
    const availability: TrainerAvailability = {
      id: this.generateId(),
      trainerId: input.trainerId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      status: input.status || 'available',
      notes: input.notes,
      recurringPattern: input.recurringPattern,
      createdAt: now,
      updatedAt: now,
    };

    this.availabilities.push(availability);

    // Create recurring instances if pattern is specified
    if (input.recurringPattern) {
      await this.createRecurringAvailabilities(availability);
    }

    return availability;
  }

  /**
   * Create recurring availabilities
   */
  private static async createRecurringAvailabilities(
    baseAvailability: TrainerAvailability
  ): Promise<void> {
    if (!baseAvailability.recurringPattern) {
      return;
    }

    const { type, interval, endDate } = baseAvailability.recurringPattern;
    const currentDate = new Date(baseAvailability.date);
    const end = endDate ? new Date(endDate) : new Date();
    end.setFullYear(end.getFullYear() + 1); // Default to 1 year in the future

    const nextDate = new Date(currentDate);

    while (nextDate <= end) {
      switch (type) {
        case 'daily':
          nextDate.setDate(nextDate.getDate() + interval);
          break;
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + 7 * interval);
          break;
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + interval);
          break;
        case 'yearly':
          nextDate.setFullYear(nextDate.getFullYear() + interval);
          break;
      }

      if (nextDate > end) {
        break;
      }

      const newAvailability: TrainerAvailability = {
        ...baseAvailability,
        id: this.generateId(),
        date: nextDate.toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.availabilities.push(newAvailability);
    }
  }

  /**
   * Get trainer availability by ID
   */
  static async getTrainerAvailabilityById(id: string): Promise<TrainerAvailability | null> {
    return this.availabilities.find((a) => a.id === id) || null;
  }

  /**
   * Get trainer availabilities by trainer ID
   */
  static async getTrainerAvailabilitiesByTrainerId(
    trainerId: string
  ): Promise<TrainerAvailability[]> {
    return this.availabilities.filter((a) => a.trainerId === trainerId);
  }

  /**
   * Get all trainer availabilities
   */
  static async getAllTrainerAvailabilities(): Promise<TrainerAvailability[]> {
    return [...this.availabilities];
  }

  /**
   * Query trainer availabilities
   */
  static async queryTrainerAvailabilities(
    query: AvailabilityQuery
  ): Promise<TrainerAvailability[]> {
    let results = this.availabilities;

    if (query.trainerId) {
      results = results.filter((a) => a.trainerId === query.trainerId);
    }

    if (query.startDate) {
      results = results.filter((a) => a.date >= query.startDate!);
    }

    if (query.endDate) {
      results = results.filter((a) => a.date <= query.endDate!);
    }

    if (query.status) {
      results = results.filter((a) => a.status === query.status);
    }

    return results;
  }

  /**
   * Get available trainers for a specific date and time
   */
  static async getAvailableTrainers(
    date: string,
    startTime: string,
    endTime: string
  ): Promise<string[]> {
    const availableTrainerIds = new Set<string>();

    const relevantAvailabilities = this.availabilities.filter(
      (a) =>
        a.date === date &&
        a.status === 'available' &&
        a.startTime <= startTime &&
        a.endTime >= endTime
    );

    for (const availability of relevantAvailabilities) {
      // Check if there are any conflicts
      const conflicts = await this.checkForConflicts(
        availability.trainerId,
        date,
        startTime,
        endTime,
        availability.id
      );

      if (conflicts.length === 0) {
        availableTrainerIds.add(availability.trainerId);
      }
    }

    return Array.from(availableTrainerIds);
  }

  /**
   * Update trainer availability
   */
  static async updateTrainerAvailability(
    id: string,
    input: UpdateTrainerAvailabilityInput
  ): Promise<TrainerAvailability | null> {
    const index = this.availabilities.findIndex((a) => a.id === id);
    if (index === -1) {
      return null;
    }

    const existing = this.availabilities[index];

    // Check for conflicts if time is changing
    if ((input.date || input.startTime || input.endTime) && input.status !== 'unavailable') {
      const newDate = input.date || existing.date;
      const newStart = input.startTime || existing.startTime;
      const newEnd = input.endTime || existing.endTime;

      const conflicts = await this.checkForConflicts(
        existing.trainerId,
        newDate,
        newStart,
        newEnd,
        id
      );

      if (conflicts.length > 0) {
        throw new Error(`Conflicts detected: ${conflicts.map((c) => c.conflictType).join(', ')}`);
      }
    }

    const updated: TrainerAvailability = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    this.availabilities[index] = updated;
    return updated;
  }

  /**
   * Delete trainer availability
   */
  static async deleteTrainerAvailability(id: string): Promise<boolean> {
    const index = this.availabilities.findIndex((a) => a.id === id);
    if (index === -1) {
      return false;
    }

    this.availabilities.splice(index, 1);
    return true;
  }

  /**
   * Compute availability conflicts from a list of availabilities.
   * Pure utility — does not use in-memory state.
   */
  static getAvailabilityConflicts(availabilities: TrainerAvailability[]): AvailabilityConflict[] {
    const conflicts: AvailabilityConflict[] = [];

    // Group by trainer and date
    const grouped = new Map<string, TrainerAvailability[]>();
    for (const availability of availabilities) {
      const key = `${availability.trainerId}-${availability.date}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(availability);
    }

    // Check for overlaps within each group
    for (const [key, group] of grouped) {
      const [trainerId, date] = key.split('-');

      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a1 = group[i];
          const a2 = group[j];

          if (TrainerAvailabilityService.hasTimeOverlap(a1, a2.startTime, a2.endTime)) {
            conflicts.push({
              id: `avail-conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              trainerId,
              trainerName: 'Trainer',
              date,
              startTime: a1.startTime,
              endTime: a1.endTime,
              conflictType: 'overlap',
              conflictingWith: [a1.id, a2.id],
            });
          }
        }
      }
    }

    return conflicts;
  }
}

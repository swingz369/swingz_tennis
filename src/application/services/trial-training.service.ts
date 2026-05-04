import type {
  TrialTraining,
  CreateTrialTrainingInput,
  UpdateTrialTrainingInput,
  TrialTrainingStats,
} from '../../domain/entities/trial-training.entity';

export class TrialTrainingService {
  private static trainings: TrialTraining[] = [];

  /**
   * Generate a unique ID for trial training
   */
  private static generateId(): string {
    return `trial-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate trial training input
   */
  static validateTrialTrainingInput(input: CreateTrialTrainingInput): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!input.participant.firstName || input.participant.firstName.trim().length < 2) {
      errors.push('Vorname muss mindestens 2 Zeichen lang sein');
    }

    if (!input.participant.lastName || input.participant.lastName.trim().length < 2) {
      errors.push('Nachname muss mindestens 2 Zeichen lang sein');
    }

    if (!input.participant.email || !this.isValidEmail(input.participant.email)) {
      errors.push('Ungültige E-Mail-Adresse');
    }

    if (!input.participant.phone || input.participant.phone.trim().length < 5) {
      errors.push('Telefonnummer muss mindestens 5 Zeichen lang sein');
    }

    if (!input.participant.dateOfBirth || !this.isValidDate(input.participant.dateOfBirth)) {
      errors.push('Ungültiges Geburtsdatum');
    }

    if (!input.scheduledDate || !this.isValidDate(input.scheduledDate)) {
      errors.push('Ungültiges Trainingsdatum');
    }

    if (!input.scheduledTime || !this.isValidTime(input.scheduledTime)) {
      errors.push('Ungültige Trainingszeit');
    }

    if (!input.duration || input.duration < 30 || input.duration > 180) {
      errors.push('Dauer muss zwischen 30 und 180 Minuten liegen');
    }

    if (!input.trainerId || input.trainerId.trim().length === 0) {
      errors.push('Trainer-ID ist erforderlich');
    }

    if (!input.courtId || input.courtId.trim().length === 0) {
      errors.push('Platz-ID ist erforderlich');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate email format
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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
   * Create a new trial training
   */
  static async createTrialTraining(input: CreateTrialTrainingInput): Promise<TrialTraining> {
    const validation = this.validateTrialTrainingInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const now = new Date().toISOString();
    const trialTraining: TrialTraining = {
      id: this.generateId(),
      participant: {
        id: `participant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...input.participant,
      },
      scheduledDate: input.scheduledDate,
      scheduledTime: input.scheduledTime,
      duration: input.duration,
      trainer: {
        id: input.trainerId,
        name: 'Trainer', // In production, fetch trainer name from database
      },
      court: {
        id: input.courtId,
        name: 'Platz', // In production, fetch court name from database
      },
      status: 'scheduled',
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    this.trainings.push(trialTraining);
    return trialTraining;
  }

  /**
   * Get trial training by ID
   */
  static async getTrialTrainingById(id: string): Promise<TrialTraining | null> {
    return this.trainings.find((t) => t.id === id) || null;
  }

  /**
   * Get all trial trainings
   */
  static async getAllTrialTrainings(): Promise<TrialTraining[]> {
    return [...this.trainings];
  }

  /**
   * Get trial trainings by status
   */
  static async getTrialTrainingsByStatus(
    status: TrialTraining['status']
  ): Promise<TrialTraining[]> {
    return this.trainings.filter((t) => t.status === status);
  }

  /**
   * Get trial trainings by participant email
   */
  static async getTrialTrainingsByParticipantEmail(email: string): Promise<TrialTraining[]> {
    return this.trainings.filter((t) => t.participant.email.toLowerCase() === email.toLowerCase());
  }

  /**
   * Update trial training
   */
  static async updateTrialTraining(
    id: string,
    input: UpdateTrialTrainingInput
  ): Promise<TrialTraining | null> {
    const index = this.trainings.findIndex((t) => t.id === id);
    if (index === -1) {
      return null;
    }

    const existing = this.trainings[index];
    const updated: TrialTraining = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    this.trainings[index] = updated;
    return updated;
  }

  /**
   * Update trial training status
   */
  static async updateTrialTrainingStatus(
    id: string,
    status: TrialTraining['status']
  ): Promise<TrialTraining | null> {
    return this.updateTrialTraining(id, { status });
  }

  /**
   * Add feedback to trial training
   */
  static async addTrialTrainingFeedback(
    id: string,
    feedback: TrialTraining['feedback']
  ): Promise<TrialTraining | null> {
    return this.updateTrialTraining(id, { feedback });
  }

  /**
   * Convert trial training to member
   */
  static async convertTrialToMember(id: string, memberId: string): Promise<TrialTraining | null> {
    return this.updateTrialTraining(id, {
      status: 'converted',
      convertedToMemberId: memberId,
    });
  }

  /**
   * Delete trial training
   */
  static async deleteTrialTraining(id: string): Promise<boolean> {
    const index = this.trainings.findIndex((t) => t.id === id);
    if (index === -1) {
      return false;
    }

    this.trainings.splice(index, 1);
    return true;
  }

  /**
   * Get trial training statistics
   */
  static async getTrialTrainingStats(): Promise<TrialTrainingStats> {
    const total = this.trainings.length;
    const scheduled = this.trainings.filter((t) => t.status === 'scheduled').length;
    const completed = this.trainings.filter((t) => t.status === 'completed').length;
    const cancelled = this.trainings.filter((t) => t.status === 'cancelled').length;
    const noShow = this.trainings.filter((t) => t.status === 'no_show').length;
    const converted = this.trainings.filter((t) => t.status === 'converted').length;

    const conversionRate = completed > 0 ? Math.round((converted / completed) * 100) : 0;

    return {
      total,
      scheduled,
      completed,
      cancelled,
      noShow,
      converted,
      conversionRate,
    };
  }

  /**
   * Get trial trainings scheduled in the next N days
   */
  static async getUpcomingTrialTrainings(days: number = 7): Promise<TrialTraining[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.trainings.filter((t) => {
      const scheduledDate = new Date(t.scheduledDate);
      return t.status === 'scheduled' && scheduledDate >= now && scheduledDate <= futureDate;
    });
  }

  /**
   * Get trial trainings that need reminders (scheduled within 24 hours)
   */
  static async getTrialTrainingsNeedingReminder(): Promise<TrialTraining[]> {
    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.trainings.filter((t) => {
      const scheduledDate = new Date(t.scheduledDate);
      return t.status === 'scheduled' && scheduledDate >= now && scheduledDate <= tomorrow;
    });
  }

  /**
   * Search trial trainings
   */
  static async searchTrialTrainings(query: string): Promise<TrialTraining[]> {
    const lowerQuery = query.toLowerCase();
    return this.trainings.filter((t) =>
      `${t.participant.firstName} ${t.participant.lastName} ${t.participant.email}`
        .toLowerCase()
        .includes(lowerQuery)
    );
  }

  /**
   * Initialize with mock data (for development)
   */
  static initializeMockData(): void {
    const now = new Date();

    this.trainings = [
      {
        id: '1',
        participant: {
          id: 'p1',
          firstName: 'Max',
          lastName: 'Mustermann',
          email: 'max.mustermann@example.com',
          phone: '+49 123 456 7890',
          dateOfBirth: '1990-05-15',
        },
        scheduledDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        scheduledTime: '10:00',
        duration: 60,
        trainer: {
          id: 't1',
          name: 'Thomas Müller',
        },
        court: {
          id: 'c1',
          name: 'Platz 1',
        },
        status: 'scheduled',
        notes: 'Erster Kontakt per E-Mail',
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '2',
        participant: {
          id: 'p2',
          firstName: 'Anna',
          lastName: 'Schmidt',
          email: 'anna.schmidt@example.com',
          phone: '+49 987 654 3210',
          dateOfBirth: '1985-08-22',
        },
        scheduledDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        scheduledTime: '14:00',
        duration: 60,
        trainer: {
          id: 't2',
          name: 'Julia Weber',
        },
        court: {
          id: 'c2',
          name: 'Platz 2',
        },
        status: 'completed',
        feedback: {
          rating: 5,
          comments: 'Sehr gutes Training, habe mich sehr wohlgefühlt!',
          wouldRecommend: true,
        },
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '3',
        participant: {
          id: 'p3',
          firstName: 'Peter',
          lastName: 'Klein',
          email: 'peter.klein@example.com',
          phone: '+49 555 123 4567',
          dateOfBirth: '1995-12-03',
        },
        scheduledDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        scheduledTime: '16:00',
        duration: 60,
        trainer: {
          id: 't1',
          name: 'Thomas Müller',
        },
        court: {
          id: 'c3',
          name: 'Platz 3',
        },
        status: 'no_show',
        notes: 'Keine Ankunft, keine Rückmeldung auf Anrufe',
        createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '4',
        participant: {
          id: 'p4',
          firstName: 'Maria',
          lastName: 'Gross',
          email: 'maria.gross@example.com',
          phone: '+49 444 987 6543',
          dateOfBirth: '1988-03-17',
        },
        scheduledDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        scheduledTime: '11:00',
        duration: 60,
        trainer: {
          id: 't2',
          name: 'Julia Weber',
        },
        court: {
          id: 'c1',
          name: 'Platz 1',
        },
        status: 'converted',
        feedback: {
          rating: 4,
          comments: 'Gutes Training, habe mich angemeldet',
          wouldRecommend: true,
        },
        notes: 'Hat direkt Mitgliedschaft abgeschlossen',
        convertedToMemberId: 'member-123',
        createdAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
  }
}

// Initialize mock data
TrialTrainingService.initializeMockData();

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
    const d = (days: number) => new Date(now.getTime() + days * 86400000).toISOString();
    const dp = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();

    this.trainings = [
      // --- Scheduled (upcoming) ---
      {
        id: '1', participant: { id: 'p1', firstName: 'Max', lastName: 'Mustermann', email: 'max.mustermann@example.com', phone: '+49 123 456 7890', dateOfBirth: '1990-05-15' },
        scheduledDate: d(2), scheduledTime: '10:00', duration: 60,
        trainer: { id: 'trainer-1', name: 'Thomas Müller' }, court: { id: 'c1', name: 'Platz 1' },
        status: 'scheduled', notes: 'Erster Kontakt per E-Mail', createdAt: dp(1), updatedAt: dp(1),
      },
      {
        id: '5', participant: { id: 'p5', firstName: 'Lena', lastName: 'Fischer', email: 'lena.fischer@example.com', phone: '+49 176 111 2222', dateOfBirth: '1992-02-14' },
        scheduledDate: d(3), scheduledTime: '09:00', duration: 90,
        trainer: { id: 'trainer-2', name: 'Julia Weber' }, court: { id: 'c2', name: 'Platz 2' },
        status: 'scheduled', notes: 'Interessiert an Gruppen-Training', createdAt: dp(0), updatedAt: dp(0),
      },
      {
        id: '6', participant: { id: 'p6', firstName: 'Felix', lastName: 'Wagner', email: 'felix.wagner@example.com', phone: '+49 176 333 4444', dateOfBirth: '1987-11-08' },
        scheduledDate: d(4), scheduledTime: '15:00', duration: 60,
        trainer: { id: 'trainer-1', name: 'Thomas Müller' }, court: { id: 'c3', name: 'Platz 3' },
        status: 'scheduled', notes: 'Hat Vorkenntnisse aus Schulsport', createdAt: dp(0), updatedAt: dp(0),
      },
      {
        id: '7', participant: { id: 'p7', firstName: 'Sophie', lastName: 'Becker', email: 'sophie.becker@example.com', phone: '+49 151 555 6666', dateOfBirth: '1998-07-22' },
        scheduledDate: d(5), scheduledTime: '11:00', duration: 60,
        trainer: { id: 'trainer-2', name: 'Julia Weber' }, court: { id: 'c1', name: 'Platz 1' },
        status: 'scheduled', notes: 'Anfängerin, braucht Schläger', createdAt: dp(0), updatedAt: dp(0),
      },
      {
        id: '8', participant: { id: 'p8', firstName: 'Tom', lastName: 'Hoffmann', email: 'tom.hoffmann@example.com', phone: '+49 160 777 8888', dateOfBirth: '2001-03-30' },
        scheduledDate: d(7), scheduledTime: '16:30', duration: 90,
        trainer: { id: 'trainer-1', name: 'Thomas Müller' }, court: { id: 'c2', name: 'Platz 2' },
        status: 'scheduled', createdAt: dp(1), updatedAt: dp(1),
      },
      // --- Completed ---
      {
        id: '2', participant: { id: 'p2', firstName: 'Anna', lastName: 'Schmidt', email: 'anna.schmidt@example.com', phone: '+49 987 654 3210', dateOfBirth: '1985-08-22' },
        scheduledDate: dp(1), scheduledTime: '14:00', duration: 60,
        trainer: { id: 'trainer-2', name: 'Julia Weber' }, court: { id: 'c2', name: 'Platz 2' },
        status: 'completed', feedback: { rating: 5, comments: 'Sehr gutes Training, habe mich sehr wohlgefühlt!', wouldRecommend: true },
        createdAt: dp(3), updatedAt: dp(1),
      },
      {
        id: '9', participant: { id: 'p9', firstName: 'Marco', lastName: 'Ricci', email: 'marco.ricci@example.com', phone: '+49 178 999 0001', dateOfBirth: '1983-04-11' },
        scheduledDate: dp(2), scheduledTime: '10:00', duration: 60,
        trainer: { id: 'trainer-1', name: 'Thomas Müller' }, court: { id: 'c3', name: 'Platz 3' },
        status: 'completed', feedback: { rating: 4, comments: 'Gute Einführung, Trainer sehr geduldig', wouldRecommend: true },
        createdAt: dp(4), updatedAt: dp(2),
      },
      {
        id: '10', participant: { id: 'p10', firstName: 'Klara', lastName: 'Nowak', email: 'klara.nowak@example.com', phone: '+49 152 222 3333', dateOfBirth: '1993-09-05' },
        scheduledDate: dp(4), scheduledTime: '13:00', duration: 90,
        trainer: { id: 'trainer-2', name: 'Julia Weber' }, court: { id: 'c1', name: 'Platz 1' },
        status: 'completed', feedback: { rating: 5, comments: 'Perfekt! Werde definitiv Mitglied.', wouldRecommend: true },
        createdAt: dp(6), updatedAt: dp(4),
      },
      {
        id: '11', participant: { id: 'p11', firstName: 'David', lastName: 'Schulz', email: 'david.schulz@example.com', phone: '+49 179 444 5555', dateOfBirth: '1979-12-19' },
        scheduledDate: dp(7), scheduledTime: '17:00', duration: 60,
        trainer: { id: 'trainer-1', name: 'Thomas Müller' }, court: { id: 'c2', name: 'Platz 2' },
        status: 'completed', feedback: { rating: 3, comments: 'War okay, aber zeitlich passt es leider nicht', wouldRecommend: false },
        createdAt: dp(9), updatedAt: dp(7),
      },
      {
        id: '12', participant: { id: 'p12', firstName: 'Nina', lastName: 'Vogel', email: 'nina.vogel@example.com', phone: '+49 173 666 7777', dateOfBirth: '1996-06-28' },
        scheduledDate: dp(9), scheduledTime: '09:30', duration: 60,
        trainer: { id: 'trainer-2', name: 'Julia Weber' }, court: { id: 'c3', name: 'Platz 3' },
        status: 'completed', feedback: { rating: 5, comments: 'Super Coaching, hat richtig Spaß gemacht', wouldRecommend: true },
        createdAt: dp(11), updatedAt: dp(9),
      },
      // --- No-show ---
      {
        id: '3', participant: { id: 'p3', firstName: 'Peter', lastName: 'Klein', email: 'peter.klein@example.com', phone: '+49 555 123 4567', dateOfBirth: '1995-12-03' },
        scheduledDate: dp(5), scheduledTime: '16:00', duration: 60,
        trainer: { id: 'trainer-1', name: 'Thomas Müller' }, court: { id: 'c3', name: 'Platz 3' },
        status: 'no_show', notes: 'Keine Ankunft, keine Rückmeldung auf Anrufe', createdAt: dp(7), updatedAt: dp(5),
      },
      {
        id: '13', participant: { id: 'p13', firstName: 'Jan', lastName: 'Krüger', email: 'jan.krueger@example.com', phone: '+49 157 888 9999', dateOfBirth: '1989-01-15' },
        scheduledDate: dp(12), scheduledTime: '11:00', duration: 60,
        trainer: { id: 'trainer-2', name: 'Julia Weber' }, court: { id: 'c1', name: 'Platz 1' },
        status: 'no_show', notes: 'Keine Rückmeldung, telefonisch nicht erreichbar', createdAt: dp(14), updatedAt: dp(12),
      },
      // --- Cancelled ---
      {
        id: '14', participant: { id: 'p14', firstName: 'Emma', lastName: 'Lehmann', email: 'emma.lehmann@example.com', phone: '+49 162 000 1111', dateOfBirth: '2002-10-10' },
        scheduledDate: d(1), scheduledTime: '14:00', duration: 60,
        trainer: { id: 'trainer-1', name: 'Thomas Müller' }, court: { id: 'c2', name: 'Platz 2' },
        status: 'cancelled', notes: 'Abgesagt wegen Krankheit, möchte neuen Termin', createdAt: dp(2), updatedAt: dp(1),
      },
      {
        id: '15', participant: { id: 'p15', firstName: 'Oliver', lastName: 'Mayer', email: 'oliver.mayer@example.com', phone: '+49 174 222 3333', dateOfBirth: '1975-05-20' },
        scheduledDate: dp(3), scheduledTime: '18:00', duration: 90,
        trainer: { id: 'trainer-2', name: 'Julia Weber' }, court: { id: 'c3', name: 'Platz 3' },
        status: 'cancelled', notes: 'Terminkonflikt, eventuell später wieder', createdAt: dp(5), updatedAt: dp(3),
      },
      // --- Converted ---
      {
        id: '4', participant: { id: 'p4', firstName: 'Maria', lastName: 'Gross', email: 'maria.gross@example.com', phone: '+49 444 987 6543', dateOfBirth: '1988-03-17' },
        scheduledDate: dp(10), scheduledTime: '11:00', duration: 60,
        trainer: { id: 'trainer-2', name: 'Julia Weber' }, court: { id: 'c1', name: 'Platz 1' },
        status: 'converted', feedback: { rating: 4, comments: 'Gutes Training, habe mich angemeldet', wouldRecommend: true },
        notes: 'Hat direkt Mitgliedschaft abgeschlossen', convertedToMemberId: 'member-123', createdAt: dp(12), updatedAt: dp(10),
      },
      {
        id: '16', participant: { id: 'p16', firstName: 'Sabine', lastName: 'Wolf', email: 'sabine.wolf@example.com', phone: '+49 151 444 5555', dateOfBirth: '1981-07-07' },
        scheduledDate: dp(15), scheduledTime: '10:00', duration: 60,
        trainer: { id: 'trainer-1', name: 'Thomas Müller' }, court: { id: 'c2', name: 'Platz 2' },
        status: 'converted', feedback: { rating: 5, comments: 'Beste Entscheidung!', wouldRecommend: true },
        notes: 'Familienmitgliedschaft abgeschlossen', convertedToMemberId: 'member-456', createdAt: dp(17), updatedAt: dp(15),
      },
      {
        id: '17', participant: { id: 'p17', firstName: 'Christian', lastName: 'Braun', email: 'christian.braun@example.com', phone: '+49 176 666 7777', dateOfBirth: '1991-09-30' },
        scheduledDate: dp(20), scheduledTime: '15:00', duration: 90,
        trainer: { id: 'trainer-2', name: 'Julia Weber' }, court: { id: 'c3', name: 'Platz 3' },
        status: 'converted', feedback: { rating: 4, comments: 'Gute Trainingsatmosphäre', wouldRecommend: true },
        notes: 'Premium-Mitgliedschaft', convertedToMemberId: 'member-789', createdAt: dp(22), updatedAt: dp(20),
      },
      {
        id: '18', participant: { id: 'p18', firstName: 'Laura', lastName: 'Kaiser', email: 'laura.kaiser@example.com', phone: '+49 163 888 9999', dateOfBirth: '1994-02-18' },
        scheduledDate: dp(25), scheduledTime: '12:00', duration: 60,
        trainer: { id: 'trainer-1', name: 'Thomas Müller' }, court: { id: 'c1', name: 'Platz 1' },
        status: 'converted', feedback: { rating: 5, comments: 'Hervorragendes Probetraining!', wouldRecommend: true },
        convertedToMemberId: 'member-101', createdAt: dp(27), updatedAt: dp(25),
      },
      // --- Additional scheduled & completed mix ---
      {
        id: '19', participant: { id: 'p19', firstName: 'Michael', lastName: 'Sommer', email: 'michael.sommer@example.com', phone: '+49 170 111 2222', dateOfBirth: '1986-04-25' },
        scheduledDate: d(6), scheduledTime: '08:00', duration: 60,
        trainer: { id: 'trainer-2', name: 'Julia Weber' }, court: { id: 'c1', name: 'Platz 1' },
        status: 'scheduled', notes: 'Frühaufsteher, bevorzugt Termine vor 9 Uhr', createdAt: dp(0), updatedAt: dp(0),
      },
      {
        id: '20', participant: { id: 'p20', firstName: 'Hannah', lastName: 'Zimmermann', email: 'hannah.zimmermann@example.com', phone: '+49 159 333 4444', dateOfBirth: '1999-12-01' },
        scheduledDate: dp(14), scheduledTime: '16:00', duration: 60,
        trainer: { id: 'trainer-1', name: 'Thomas Müller' }, court: { id: 'c2', name: 'Platz 2' },
        status: 'completed', feedback: { rating: 5, comments: 'Trainer hat viel Erfahrung, sehr empfehlenswert', wouldRecommend: true },
        createdAt: dp(16), updatedAt: dp(14),
      },
      {
        id: '21', participant: { id: 'p21', firstName: 'Philipp', lastName: 'Schäfer', email: 'philipp.schaefer@example.com', phone: '+49 171 555 6666', dateOfBirth: '1978-11-11' },
        scheduledDate: dp(18), scheduledTime: '10:30', duration: 90,
        trainer: { id: 'trainer-2', name: 'Julia Weber' }, court: { id: 'c3', name: 'Platz 3' },
        status: 'completed', feedback: { rating: 4, comments: 'Gutes Training, aber Anlage könnte besser sein', wouldRecommend: true },
        createdAt: dp(20), updatedAt: dp(18),
      },
      {
        id: '22', participant: { id: 'p22', firstName: 'Carolin', lastName: 'Ebert', email: 'carolin.ebert@example.com', phone: '+49 175 777 8888', dateOfBirth: '1997-05-03' },
        scheduledDate: dp(21), scheduledTime: '14:30', duration: 60,
        trainer: { id: 'trainer-1', name: 'Thomas Müller' }, court: { id: 'c1', name: 'Platz 1' },
        status: 'completed', feedback: { rating: 3, comments: 'Nette Trainer, aber Sportart ist nichts für mich', wouldRecommend: false },
        createdAt: dp(23), updatedAt: dp(21),
      },
      {
        id: '23', participant: { id: 'p23', firstName: 'Sebastian', lastName: 'Lange', email: 'sebastian.lange@example.com', phone: '+49 177 999 0000', dateOfBirth: '1984-08-16' },
        scheduledDate: dp(28), scheduledTime: '11:00', duration: 60,
        trainer: { id: 'trainer-2', name: 'Julia Weber' }, court: { id: 'c2', name: 'Platz 2' },
        status: 'completed', feedback: { rating: 5, comments: 'Bin begeistert, starte nächste Woche als Mitglied', wouldRecommend: true },
        createdAt: dp(30), updatedAt: dp(28),
      },
      {
        id: '24', participant: { id: 'p24', firstName: 'Anja', lastName: 'Friedrich', email: 'anja.friedrich@example.com', phone: '+49 152 111 2223', dateOfBirth: '2000-01-05' },
        scheduledDate: d(10), scheduledTime: '17:00', duration: 60,
        trainer: { id: 'trainer-1', name: 'Thomas Müller' }, court: { id: 'c3', name: 'Platz 3' },
        status: 'scheduled', notes: 'Studentenrabatt angefragt', createdAt: dp(0), updatedAt: dp(0),
      },
      {
        id: '25', participant: { id: 'p25', firstName: 'Tobias', lastName: 'Arnold', email: 'tobias.arnold@example.com', phone: '+49 169 444 5556', dateOfBirth: '1972-06-20' },
        scheduledDate: d(14), scheduledTime: '09:00', duration: 90,
        trainer: { id: 'trainer-2', name: 'Julia Weber' }, court: { id: 'c1', name: 'Platz 1' },
        status: 'scheduled', notes: 'Ehemaliger Hobby-Spieler, will wieder einsteigen', createdAt: dp(1), updatedAt: dp(1),
      },
    ];
  }
}

// Initialize mock data
if (process.env.NODE_ENV !== 'production') {
  TrialTrainingService.initializeMockData();
}

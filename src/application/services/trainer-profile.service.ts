import { TrainerProfile, CreateTrainerProfileInput, UpdateTrainerProfileInput } from '../../domain/entities/trainer.entity';

export class TrainerProfileService {
  private static profiles: TrainerProfile[] = [];

  /**
   * Generate a unique ID for trainer profile
   */
  private static generateId(): string {
    return `trainer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate trainer profile input
   */
  static validateTrainerProfileInput(input: CreateTrainerProfileInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.firstName || input.firstName.trim().length < 2) {
      errors.push('Vorname muss mindestens 2 Zeichen lang sein');
    }

    if (!input.lastName || input.lastName.trim().length < 2) {
      errors.push('Nachname muss mindestens 2 Zeichen lang sein');
    }

    if (!input.email || !this.isValidEmail(input.email)) {
      errors.push('Ungültige E-Mail-Adresse');
    }

    if (!input.phone || input.phone.trim().length < 5) {
      errors.push('Telefonnummer muss mindestens 5 Zeichen lang sein');
    }

    if (!input.dateOfBirth || !this.isValidDate(input.dateOfBirth)) {
      errors.push('Ungültiges Geburtsdatum');
    }

    if (!input.userId || input.userId.trim().length === 0) {
      errors.push('Benutzer-ID ist erforderlich');
    }

    if (input.experience && input.experience.years < 0) {
      errors.push('Erfahrung in Jahren darf nicht negativ sein');
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
   * Create a new trainer profile
   */
  static async createTrainerProfile(input: CreateTrainerProfileInput): Promise<TrainerProfile> {
    const validation = this.validateTrainerProfileInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const now = new Date().toISOString();
    const trainerProfile: TrainerProfile = {
      id: this.generateId(),
      userId: input.userId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      dateOfBirth: input.dateOfBirth,
      bio: input.bio,
      qualifications: (input.qualifications || []).map((q) => ({
        ...q,
        id: `qual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        verified: false,
      })),
      specializations: (input.specializations || []).map((s) => ({
        ...s,
        id: `spec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      })),
      experience: input.experience || {
        years: 0,
        previousClubs: [],
        achievements: [],
      },
      status: 'active',
      availability: {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
      },
      preferredTimeSlots: input.preferredTimeSlots || [],
      languages: input.languages || ['Deutsch'],
      emergencyContact: input.emergencyContact || {
        name: '',
        phone: '',
        relationship: '',
      },
      createdAt: now,
      updatedAt: now,
    };

    this.profiles.push(trainerProfile);
    return trainerProfile;
  }

  /**
   * Get trainer profile by ID
   */
  static async getTrainerProfileById(id: string): Promise<TrainerProfile | null> {
    return this.profiles.find((p) => p.id === id) || null;
  }

  /**
   * Get trainer profile by user ID
   */
  static async getTrainerProfileByUserId(userId: string): Promise<TrainerProfile | null> {
    return this.profiles.find((p) => p.userId === userId) || null;
  }

  /**
   * Get all trainer profiles
   */
  static async getAllTrainerProfiles(): Promise<TrainerProfile[]> {
    return [...this.profiles];
  }

  /**
   * Get trainer profiles by status
   */
  static async getTrainerProfilesByStatus(status: TrainerProfile['status']): Promise<TrainerProfile[]> {
    return this.profiles.filter((p) => p.status === status);
  }

  /**
   * Get active trainers
   */
  static async getActiveTrainers(): Promise<TrainerProfile[]> {
    return this.profiles.filter((p) => p.status === 'active');
  }

  /**
   * Update trainer profile
   */
  static async updateTrainerProfile(id: string, input: UpdateTrainerProfileInput): Promise<TrainerProfile | null> {
    const index = this.profiles.findIndex((p) => p.id === id);
    if (index === -1) {
      return null;
    }

    const existing = this.profiles[index];
    const updated: TrainerProfile = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    this.profiles[index] = updated;
    return updated;
  }

  /**
   * Update trainer status
   */
  static async updateTrainerStatus(
    id: string,
    status: TrainerProfile['status']
  ): Promise<TrainerProfile | null> {
    return this.updateTrainerProfile(id, { status });
  }

  /**
   * Add qualification to trainer profile
   */
  static async addQualification(
    id: string,
    qualification: Omit<TrainerProfile['qualifications'][0], 'id' | 'verified' | 'verifiedAt' | 'verifiedBy'>
  ): Promise<TrainerProfile | null> {
    const profile = await this.getTrainerProfileById(id);
    if (!profile) {
      return null;
    }

    const newQualification = {
      ...qualification,
      id: `qual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      verified: false,
    };

    return this.updateTrainerProfile(id, {
      qualifications: [...profile.qualifications, newQualification],
    });
  }

  /**
   * Verify qualification
   */
  static async verifyQualification(
    trainerId: string,
    qualificationId: string,
    verifiedBy: string
  ): Promise<TrainerProfile | null> {
    const profile = await this.getTrainerProfileById(trainerId);
    if (!profile) {
      return null;
    }

    const updatedQualifications = profile.qualifications.map((q) =>
      q.id === qualificationId
        ? {
            ...q,
            verified: true,
            verifiedAt: new Date().toISOString(),
            verifiedBy,
          }
        : q
    );

    return this.updateTrainerProfile(trainerId, {
      qualifications: updatedQualifications,
    });
  }

  /**
   * Delete trainer profile
   */
  static async deleteTrainerProfile(id: string): Promise<boolean> {
    const index = this.profiles.findIndex((p) => p.id === id);
    if (index === -1) {
      return false;
    }

    this.profiles.splice(index, 1);
    return true;
  }

  /**
   * Search trainer profiles
   */
  static async searchTrainerProfiles(query: string): Promise<TrainerProfile[]> {
    const lowerQuery = query.toLowerCase();
    return this.profiles.filter(
      (p) =>
        `${p.firstName} ${p.lastName} ${p.email}`.toLowerCase().includes(lowerQuery) ||
        p.specializations.some((s) => s.name.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Initialize with mock data (for development)
   */
  static initializeMockData(): void {
    const now = new Date();
    
    this.profiles = [
      {
        id: 'trainer-1',
        userId: 'user-1',
        firstName: 'Thomas',
        lastName: 'Müller',
        email: 'thomas.mueller@swingz.app',
        phone: '+49 123 456 7890',
        dateOfBirth: '1980-05-15',
        bio: 'Erfahrener Tennis-Trainer mit über 15 Jahren Erfahrung. Spezialisiert auf Anfänger und Fortgeschrittene.',
        qualifications: [
          {
            id: 'qual-1',
            name: 'DTB B-Lizenz',
            issuer: 'Deutscher Tennis Bund',
            issuedDate: '2010-06-01',
            expiryDate: '2025-06-01',
            verified: true,
            verifiedAt: '2010-06-01T00:00:00.000Z',
            verifiedBy: 'DTB',
          },
          {
            id: 'qual-2',
            name: 'Fitness-Trainer B-Lizenz',
            issuer: 'Deutscher Olympischer Sportbund',
            issuedDate: '2012-03-15',
            verified: true,
            verifiedAt: '2012-03-15T00:00:00.000Z',
            verifiedBy: 'DOSB',
          },
        ],
        specializations: [
          {
            id: 'spec-1',
            name: 'Anfänger-Training',
            level: 'beginner',
          },
          {
            id: 'spec-2',
            name: 'Technik-Training',
            level: 'intermediate',
          },
        ],
        experience: {
          years: 15,
          previousClubs: ['TC Grün-Weiß', 'Tennisclub Berlin'],
          achievements: [
            'Landesmeister 2015',
            'Trainer des Jahres 2020',
          ],
        },
        status: 'active',
        hourlyRate: 45,
        availability: {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: true,
          sunday: false,
        },
        preferredTimeSlots: [
          { start: '08:00', end: '12:00' },
          { start: '14:00', end: '18:00' },
        ],
        languages: ['Deutsch', 'Englisch'],
        emergencyContact: {
          name: 'Maria Müller',
          phone: '+49 123 456 7891',
          relationship: 'Ehefrau',
        },
        createdAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'trainer-2',
        userId: 'user-2',
        firstName: 'Julia',
        lastName: 'Weber',
        email: 'julia.weber@swingz.app',
        phone: '+49 987 654 3210',
        dateOfBirth: '1985-08-22',
        bio: 'Professionelle Tennisspielerin und Trainerin. Fokus auf Wettkampfvorbereitung und Mentaltraining.',
        qualifications: [
          {
            id: 'qual-3',
            name: 'DTB A-Lizenz',
            issuer: 'Deutscher Tennis Bund',
            issuedDate: '2015-09-01',
            verified: true,
            verifiedAt: '2015-09-01T00:00:00.000Z',
            verifiedBy: 'DTB',
          },
        ],
        specializations: [
          {
            id: 'spec-3',
            name: 'Wettkampf-Training',
            level: 'professional',
          },
          {
            id: 'spec-4',
            name: 'Mentaltraining',
            level: 'advanced',
          },
        ],
        experience: {
          years: 8,
          previousClubs: ['TC Rot-Weiß'],
          achievements: [
            'Bundesliga-Spielerin',
            'Jugend-Europameisterin',
          ],
        },
        status: 'active',
        hourlyRate: 55,
        availability: {
          monday: true,
          tuesday: true,
          wednesday: false,
          thursday: true,
          friday: true,
          saturday: false,
          sunday: false,
        },
        preferredTimeSlots: [
          { start: '10:00', end: '14:00' },
          { start: '16:00', end: '20:00' },
        ],
        languages: ['Deutsch', 'Englisch', 'Französisch'],
        emergencyContact: {
          name: 'Markus Weber',
          phone: '+49 987 654 3211',
          relationship: 'Ehemann',
        },
        createdAt: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
  }
}

// Initialize mock data
TrainerProfileService.initializeMockData();

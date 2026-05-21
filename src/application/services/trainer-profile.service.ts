import type {
  TrainerProfile,
  CreateTrainerProfileInput,
  UpdateTrainerProfileInput,
} from '../../domain/entities/trainer.entity';
import { TrainerProfileRepository } from '../../infrastructure/persistence/repositories/trainer-profile.repository';

/**
 * TrainerProfileService — Drizzle-backed service.
 * All data operations go through the Drizzle repository directly.
 */
export class TrainerProfileService {
  private static repository = new TrainerProfileRepository();

  /**
   * Validate trainer profile input
   */
  static validateTrainerProfileInput(input: CreateTrainerProfileInput): {
    valid: boolean;
    errors: string[];
  } {
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

  // ═══ CRUD Operations ═══

  static async createTrainerProfile(input: CreateTrainerProfileInput): Promise<TrainerProfile> {
    const validation = this.validateTrainerProfileInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    return await this.repository.create(input);
  }

  static async getTrainerProfileById(id: string): Promise<TrainerProfile | null> {
    return await this.repository.findById(id);
  }

  static async getTrainerProfileByUserId(userId: string): Promise<TrainerProfile | null> {
    return await this.repository.findByUserId(userId);
  }

  static async getAllTrainerProfiles(): Promise<TrainerProfile[]> {
    return await this.repository.findAll();
  }

  static async getTrainerProfilesByClubId(clubId: string): Promise<TrainerProfile[]> {
    return await this.repository.findByClubId(clubId);
  }

  static async getTrainerProfilesByStatus(
    status: TrainerProfile['status']
  ): Promise<TrainerProfile[]> {
    return await this.repository.findByStatus(status);
  }

  static async getActiveTrainers(): Promise<TrainerProfile[]> {
    return await this.repository.findActiveTrainers();
  }

  static async getActiveTrainersByClubId(clubId: string): Promise<TrainerProfile[]> {
    return await this.repository.findActiveTrainersByClubId(clubId);
  }

  static async updateTrainerProfile(
    id: string,
    input: UpdateTrainerProfileInput
  ): Promise<TrainerProfile | null> {
    return await this.repository.update(id, input);
  }

  static async updateTrainerStatus(
    id: string,
    status: TrainerProfile['status']
  ): Promise<TrainerProfile | null> {
    return await this.repository.updateStatus(id, status);
  }

  static async addQualification(
    id: string,
    qualification: Omit<
      TrainerProfile['qualifications'][0],
      'id' | 'verified' | 'verifiedAt' | 'verifiedBy'
    >
  ): Promise<TrainerProfile | null> {
    return await this.repository.addQualification(id, qualification);
  }

  static async verifyQualification(
    trainerId: string,
    qualificationId: string,
    verifiedBy: string
  ): Promise<TrainerProfile | null> {
    return await this.repository.verifyQualification(trainerId, qualificationId, verifiedBy);
  }

  static async deleteTrainerProfile(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  static async searchTrainerProfiles(query: string, clubId?: string): Promise<TrainerProfile[]> {
    return await this.repository.search(query, clubId);
  }
}

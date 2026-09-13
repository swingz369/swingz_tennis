import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import { getUserDb, systemDb } from '@/infrastructure/db';
import type { Json, TablesInsert } from '@/types/supabase';
import type {
  TrainerProfile,
  CreateTrainerProfileInput,
  UpdateTrainerProfileInput,
  TrainerQualification,
} from '@/domain/entities/trainer.entity';
import {
  TrainerProfileRepository,
  normalizeQualifications,
} from '@/infrastructure/persistence/repositories/trainer-profile.repository';

const DEFAULT_AVAILABILITY = {
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: false,
  sunday: false,
};

/**
 * Trainer-Teildomäne "Profil" für ADR-005. Ein Service, ein Repository,
 * kein Adapter, keine Interfaces. Gibt weiterhin die camelCase-Entity aus
 * domain/entities/trainer.entity.ts zurück (siehe Repository-Kommentar) —
 * app/(protected)/trainer/profile/page.tsx hängt an diesem Vertrag.
 */
export class TrainerProfileService {
  private readonly repo: TrainerProfileRepository;

  constructor(auth: AuthContext) {
    this.repo = new TrainerProfileRepository(getUserDb(auth));
  }

  async createTrainerProfile(input: CreateTrainerProfileInput): Promise<TrainerProfile> {
    this.validateCreateInput(input);
    if (!input.clubId) {
      throw new ApiException(
        'VALIDATION_ERROR',
        'clubId ist zum Anlegen eines Trainer-Profils erforderlich'
      );
    }

    const system = systemDb('Trainer-Stammdatensatz anlegen (trainers hat keine INSERT-Policy)');
    const insert: TablesInsert<'trainer_profiles'> = {
      club_id: input.clubId,
      user_id: input.userId,
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
      date_of_birth: input.dateOfBirth,
      qualifications: [],
      specializations: [],
      experience: { years: 0, previousClubs: [], achievements: [] },
      status: 'active',
      availability: DEFAULT_AVAILABILITY,
      preferred_time_slots: [],
      languages: ['Deutsch'],
      emergency_contact: { name: '', phone: '', relationship: '' },
    };
    return this.repo.create(insert, system);
  }

  async getTrainerProfileById(id: string): Promise<TrainerProfile> {
    const profile = await this.repo.findById(id);
    if (!profile) throw new ApiException('NOT_FOUND', 'Trainer-Profil nicht gefunden');
    return profile;
  }

  async findTrainerProfileById(id: string): Promise<TrainerProfile | null> {
    return this.repo.findById(id);
  }

  async getTrainerProfileByUserId(userId: string): Promise<TrainerProfile | null> {
    return this.repo.findByUserId(userId);
  }

  async getTrainerProfilesByClubId(clubId: string): Promise<TrainerProfile[]> {
    return this.repo.findByClubId(clubId);
  }

  async updateTrainerProfile(
    id: string,
    input: UpdateTrainerProfileInput
  ): Promise<TrainerProfile> {
    const update: Partial<TablesInsert<'trainer_profiles'>> = {
      ...(input.firstName !== undefined && { first_name: input.firstName }),
      ...(input.lastName !== undefined && { last_name: input.lastName }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.dateOfBirth !== undefined && { date_of_birth: input.dateOfBirth }),
      ...(input.bio !== undefined && { bio: input.bio }),
      ...(input.profileImageUrl !== undefined && { profile_image_url: input.profileImageUrl }),
      ...(input.qualifications !== undefined && {
        qualifications: input.qualifications as unknown as Json,
      }),
      ...(input.specializations !== undefined && {
        specializations: input.specializations as unknown as Json,
      }),
      ...(input.experience !== undefined && { experience: input.experience as unknown as Json }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.hourlyRate !== undefined && { hourly_rate: input.hourlyRate }),
      ...(input.contractedHourlyRate !== undefined && {
        contracted_hourly_rate: input.contractedHourlyRate,
      }),
      ...(input.extraHoursRate !== undefined && { extra_hours_rate: input.extraHoursRate }),
      ...(input.availability !== undefined && {
        availability: input.availability as unknown as Json,
      }),
      ...(input.preferredTimeSlots !== undefined && {
        preferred_time_slots: input.preferredTimeSlots as unknown as Json,
      }),
      ...(input.languages !== undefined && { languages: input.languages as unknown as Json }),
      ...(input.emergencyContact !== undefined && {
        emergency_contact: input.emergencyContact as unknown as Json,
      }),
    };
    const updated = await this.repo.update(id, update);
    if (!updated) throw new ApiException('NOT_FOUND', 'Trainer-Profil nicht gefunden');
    return updated;
  }

  async addQualification(
    id: string,
    qualification: Omit<TrainerQualification, 'id' | 'verified' | 'verifiedAt' | 'verifiedBy'>
  ): Promise<TrainerProfile> {
    const profile = await this.getTrainerProfileById(id);
    const newQualification: TrainerQualification = {
      ...qualification,
      id: `qual-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      verified: false,
    };
    return this.updateTrainerProfile(id, {
      qualifications: [...normalizeQualifications(profile.qualifications), newQualification],
    });
  }

  async verifyQualification(
    trainerId: string,
    qualificationId: string,
    verifiedBy: string
  ): Promise<TrainerProfile> {
    const profile = await this.getTrainerProfileById(trainerId);
    const updatedQualifications = normalizeQualifications(profile.qualifications).map((q) =>
      q.id === qualificationId
        ? { ...q, verified: true, verifiedAt: new Date().toISOString(), verifiedBy }
        : q
    );
    return this.updateTrainerProfile(trainerId, { qualifications: updatedQualifications });
  }

  async deleteTrainerProfile(id: string): Promise<void> {
    const deleted = await this.repo.delete(id);
    if (!deleted) throw new ApiException('NOT_FOUND', 'Trainer-Profil nicht gefunden');
  }

  private validateCreateInput(input: CreateTrainerProfileInput): void {
    const errors: string[] = [];
    if (!input.firstName || input.firstName.trim().length < 2) {
      errors.push('Vorname muss mindestens 2 Zeichen lang sein');
    }
    if (!input.lastName || input.lastName.trim().length < 2) {
      errors.push('Nachname muss mindestens 2 Zeichen lang sein');
    }
    if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      errors.push('Ungültige E-Mail-Adresse');
    }
    if (!input.phone || input.phone.trim().length < 5) {
      errors.push('Telefonnummer muss mindestens 5 Zeichen lang sein');
    }
    if (!input.dateOfBirth || isNaN(new Date(input.dateOfBirth).getTime())) {
      errors.push('Ungültiges Geburtsdatum');
    }
    if (!input.userId) {
      errors.push('Benutzer-ID ist erforderlich');
    }
    if (errors.length > 0) {
      throw new ApiException('VALIDATION_ERROR', errors.join(', '));
    }
  }
}

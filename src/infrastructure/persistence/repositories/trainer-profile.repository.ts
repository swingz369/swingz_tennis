import type { SQL } from 'drizzle-orm';
import { desc, eq, ilike, or, and } from 'drizzle-orm';
import { db } from '../db';
import { trainerProfiles } from '../schema';
import type {
  TrainerProfile,
  CreateTrainerProfileInput,
  UpdateTrainerProfileInput,
  TrainerQualification,
} from '../../../domain/entities/trainer.entity';
import type { ITrainerProfileRepository } from '../../../domain/repositories/trainer-profile.repository.interface';

export class TrainerProfileRepository implements ITrainerProfileRepository {
  /**
   * Create a new trainer profile
   */
  async create(input: CreateTrainerProfileInput): Promise<TrainerProfile> {
    try {
      const now = new Date().toISOString();

      // Process qualifications with IDs and verification status
      const qualifications = (input.qualifications || []).map((q) => ({
        ...q,
        id: `qual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        verified: false,
      }));

      // Process specializations with IDs
      const specializations = (input.specializations || []).map((s) => ({
        ...s,
        id: `spec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      }));

      // Default experience
      const experience = input.experience || {
        years: 0,
        previousClubs: [],
        achievements: [],
      };

      // Default availability (Monday-Friday)
      const availability = {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
      };

      const [profile] = await db
        .insert(trainerProfiles)
        .values({
          userId: input.user_id,
          firstName: input.first_name,
          lastName: input.last_name,
          email: input.email,
          phone: input.phone,
          dateOfBirth: input.dateOfBirth,
          bio: input.bio,
          qualifications,
          specializations,
          experience,
          status: 'active',
          availability,
          preferredTimeSlots: input.preferredTimeSlots || [],
          languages: input.languages || ['Deutsch'],
          emergencyContact: input.emergencyContact || {
            name: '',
            phone: '',
            relationship: '',
          },
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!profile) {
        throw new Error('Failed to create trainer profile');
      }

      return this.mapToEntity(profile);
    } catch (error) {
      console.error('Error creating trainer profile:', error);
      throw new Error(
        `Failed to create trainer profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Find trainer profile by ID
   */
  async findById(id: string): Promise<TrainerProfile | null> {
    try {
      const [profile] = await db
        .select()
        .from(trainerProfiles)
        .where(eq(trainerProfiles.id, id))
        .limit(1);

      return profile ? this.mapToEntity(profile) : null;
    } catch (error) {
      console.error('Error finding trainer profile by ID:', error);
      throw new Error(
        `Failed to find trainer profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Find trainer profile by user ID
   */
  async findByUserId(userId: string): Promise<TrainerProfile | null> {
    try {
      const [profile] = await db
        .select()
        .from(trainerProfiles)
        .where(eq(trainerProfiles.user_id, userId))
        .limit(1);

      return profile ? this.mapToEntity(profile) : null;
    } catch (error) {
      console.error('Error finding trainer profile by user ID:', error);
      throw new Error(
        `Failed to find trainer profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Find all trainer profiles
   */
  async findAll(): Promise<TrainerProfile[]> {
    try {
      const profiles = await db
        .select()
        .from(trainerProfiles)
        .orderBy(desc(trainerProfiles.created_at));

      return profiles.map((p) => this.mapToEntity(p));
    } catch (error) {
      console.error('Error finding all trainer profiles:', error);
      throw new Error(
        `Failed to find trainer profiles: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Find trainer profiles by club ID (multi-tenant)
   */
  async findByClubId(clubId: string): Promise<TrainerProfile[]> {
    try {
      const profiles = await db
        .select()
        .from(trainerProfiles)
        .where(eq(trainerProfiles.club_id, clubId))
        .orderBy(desc(trainerProfiles.created_at));

      return profiles.map((p) => this.mapToEntity(p));
    } catch (error) {
      console.error('Error finding trainer profiles by club ID:', error);
      throw new Error(
        `Failed to find trainer profiles: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Find trainer profiles by status
   */
  async findByStatus(status: TrainerProfile['status']): Promise<TrainerProfile[]> {
    try {
      const profiles = await db
        .select()
        .from(trainerProfiles)
        .where(eq(trainerProfiles.status, status))
        .orderBy(desc(trainerProfiles.created_at));

      return profiles.map((p) => this.mapToEntity(p));
    } catch (error) {
      console.error('Error finding trainer profiles by status:', error);
      throw new Error(
        `Failed to find trainer profiles: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Find active trainers
   */
  async findActiveTrainers(): Promise<TrainerProfile[]> {
    try {
      return await this.findByStatus('active');
    } catch (error) {
      console.error('Error finding active trainers:', error);
      throw new Error(
        `Failed to find active trainers: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Find active trainers by club ID
   */
  async findActiveTrainersByClubId(clubId: string): Promise<TrainerProfile[]> {
    try {
      const profiles = await db
        .select()
        .from(trainerProfiles)
        .where(and(eq(trainerProfiles.club_id, clubId), eq(trainerProfiles.status, 'active')))
        .orderBy(desc(trainerProfiles.created_at));

      return profiles.map((p) => this.mapToEntity(p));
    } catch (error) {
      console.error('Error finding active trainers by club ID:', error);
      throw new Error(
        `Failed to find active trainers: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update trainer profile
   */
  async update(id: string, input: UpdateTrainerProfileInput): Promise<TrainerProfile | null> {
    try {
      const [updated] = await db
        .update(trainerProfiles)
        .set({
          ...input,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(trainerProfiles.id, id))
        .returning();

      return updated ? this.mapToEntity(updated) : null;
    } catch (error) {
      console.error('Error updating trainer profile:', error);
      throw new Error(
        `Failed to update trainer profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update trainer status
   */
  async updateStatus(id: string, status: TrainerProfile['status']): Promise<TrainerProfile | null> {
    try {
      return await this.update(id, { status });
    } catch (error) {
      console.error('Error updating trainer status:', error);
      throw new Error(
        `Failed to update trainer status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Add qualification to trainer profile
   */
  async addQualification(
    trainerId: string,
    qualification: Omit<TrainerQualification, 'id' | 'verified' | 'verifiedAt' | 'verifiedBy'>
  ): Promise<TrainerProfile | null> {
    try {
      const profile = await this.findById(trainerId);
      if (!profile) {
        return null;
      }

      const newQualification = {
        ...qualification,
        id: `qual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        verified: false,
      };

      return await this.update(trainerId, {
        qualifications: [...profile.qualifications, newQualification],
      });
    } catch (error) {
      console.error('Error adding qualification:', error);
      throw new Error(
        `Failed to add qualification: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Verify qualification
   */
  async verifyQualification(
    trainerId: string,
    qualificationId: string,
    verifiedBy: string
  ): Promise<TrainerProfile | null> {
    try {
      const profile = await this.findById(trainerId);
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

      return await this.update(trainerId, {
        qualifications: updatedQualifications,
      });
    } catch (error) {
      console.error('Error verifying qualification:', error);
      throw new Error(
        `Failed to verify qualification: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete trainer profile
   */
  async delete(id: string): Promise<boolean> {
    try {
      const result = await db.delete(trainerProfiles).where(eq(trainerProfiles.id, id)).returning();

      return result.length > 0;
    } catch (error) {
      console.error('Error deleting trainer profile:', error);
      throw new Error(
        `Failed to delete trainer profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Search trainer profiles
   */
  async search(query: string, clubId?: string): Promise<TrainerProfile[]> {
    try {
      const lowerQuery = query.toLowerCase();
      const conditions: SQL[] = [
        ilike(trainerProfiles.first_name, `%${lowerQuery}%`),
        ilike(trainerProfiles.last_name, `%${lowerQuery}%`),
        ilike(trainerProfiles.email, `%${lowerQuery}%`),
      ];

      let whereClause: SQL | undefined = or(...conditions);

      // Add club filter if provided
      if (clubId) {
        whereClause = and(whereClause, eq(trainerProfiles.club_id, clubId));
      }

      const profiles = await db
        .select()
        .from(trainerProfiles)
        .where(whereClause)
        .orderBy(desc(trainerProfiles.created_at));

      return profiles.map((p) => this.mapToEntity(p));
    } catch (error) {
      console.error('Error searching trainer profiles:', error);
      throw new Error(
        `Failed to search trainer profiles: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Map database row to TrainerProfile entity
   */
  private mapToEntity(row: typeof trainerProfiles.$inferSelect): TrainerProfile {
    return {
      id: row.id,
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      dateOfBirth: row.dateOfBirth,
      bio: row.bio ?? undefined,
      profileImageUrl: row.profileImageUrl ?? undefined,
      qualifications: (row.qualifications as TrainerProfile['qualifications']) || [],
      specializations: (row.specializations as TrainerProfile['specializations']) || [],
      experience: (row.experience as TrainerProfile['experience']) || {
        years: 0,
        previousClubs: [],
        achievements: [],
      },
      status: row.status as TrainerProfile['status'],
      hourlyRate:
        typeof row.hourlyRate === 'string'
          ? parseFloat(row.hourlyRate)
          : (row.hourlyRate ?? undefined),
      availability: (row.availability as TrainerProfile['availability']) || {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
      },
      preferredTimeSlots: (row.preferredTimeSlots as TrainerProfile['preferredTimeSlots']) || [],
      languages: (row.languages as string[]) || ['Deutsch'],
      emergencyContact: (row.emergencyContact as TrainerProfile['emergencyContact']) || {
        name: '',
        phone: '',
        relationship: '',
      },
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

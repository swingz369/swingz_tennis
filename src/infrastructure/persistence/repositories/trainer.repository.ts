import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../client';
import { trainers, trainerClubs } from '../schema';
import type { Trainer } from '@/domain/entities/club';
import { TrainerId, ClubId } from '@/domain/value-objects';
import type { TrainerRepository } from '@/domain/repositories/trainer-repository.interface';

export class DrizzleTrainerRepository implements TrainerRepository {
  async findById(id: TrainerId): Promise<Trainer | null> {
    const result = await db.select().from(trainers).where(eq(trainers.id, id.getValue())).limit(1);
    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findByEmail(email: string): Promise<Trainer | null> {
    const result = await db.select().from(trainers).where(eq(trainers.email, email)).limit(1);
    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findByClub(clubId: ClubId): Promise<Trainer[]> {
    const trainerClubsList = await db
      .select()
      .from(trainerClubs)
      .where(eq(trainerClubs.club_id, clubId.getValue()));
    const trainerIds = trainerClubsList.map((tc) => tc.trainer_id);
    if (trainerIds.length === 0) return [];
    const trainersData = await db.select().from(trainers).where(inArray(trainers.id, trainerIds));
    return trainersData.map((trainer) => {
      const clubIds = trainerClubsList
        .filter((tc) => tc.trainer_id === trainer.id)
        .map((tc) => ClubId.fromString(tc.club_id));
      return {
        trainerId: TrainerId.fromString(trainer.id),
        email: trainer.email,
        name: trainer.name,
        specialties: trainer.specialties,
        maxHoursPerWeek: trainer.max_hours_per_week,
        clubIds,
        isActive: trainer.is_active,
      };
    });
  }

  async findBySpecialty(specialty: string): Promise<Trainer[]> {
    const result = await db
      .select()
      .from(trainers)
      .where(sql`${trainers.specialties} @> ${[specialty]}`);
    return result.map((row) => this.mapToDomain(row));
  }

  async save(trainer: Trainer): Promise<void> {
    const now = new Date();
    const trainerData = {
      id: trainer.trainerId.getValue(),
      email: trainer.email,
      name: trainer.name,
      specialties: trainer.specialties,
      max_hours_per_week: trainer.maxHoursPerWeek,
      is_active: trainer.isActive,
      updated_at: now,
    };

    const existing = await this.findById(trainer.trainerId);
    if (existing) {
      await db
        .update(trainers)
        .set(trainerData)
        .where(eq(trainers.id, trainer.trainerId.getValue()));
    } else {
      await db.insert(trainers).values(trainerData);
    }

    // Update trainer-club relationships
    await db.delete(trainerClubs).where(eq(trainerClubs.trainer_id, trainer.trainerId.getValue()));
    for (const clubId of trainer.clubIds) {
      await db.insert(trainerClubs).values({
        trainer_id: trainer.trainerId.getValue(),
        club_id: clubId.getValue(),
        created_at: now,
      });
    }
  }

  async exists(id: TrainerId): Promise<boolean> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(trainers)
      .where(eq(trainers.id, id.getValue()));
    return result[0]?.count > 0;
  }

  private mapToDomain(row: typeof trainers.$inferSelect): Trainer {
    return {
      trainerId: TrainerId.fromString(row.id),
      email: row.email,
      name: row.name,
      specialties: row.specialties,
      maxHoursPerWeek: row.max_hours_per_week,
      clubIds: [],
      isActive: row.is_active,
    };
  }
}

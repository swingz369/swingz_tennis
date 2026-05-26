import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { trainerAvailabilities } from '../schema';
import type {
  TrainerAvailability,
  AvailabilityConflict,
  CreateTrainerAvailabilityInput,
  UpdateTrainerAvailabilityInput,
  AvailabilityQuery,
  TrainerAvailabilityRepository,
} from '@/domain/repositories/trainer-availability-repository.interface';
import { parsePostgresError } from '@/lib/errors/database-errors';

export class DrizzleTrainerAvailabilityRepository implements TrainerAvailabilityRepository {
  async create(input: CreateTrainerAvailabilityInput): Promise<TrainerAvailability> {
    const now = new Date();

    try {
      const result = await db
        .insert(trainerAvailabilities)
        .values({
          trainer_id: input.trainerId,
          date: new Date(input.date),
          start_time: input.startTime,
          end_time: input.endTime,
          status: input.status ?? 'available',
          notes: input.notes,
          recurring_pattern: input.recurringPattern ?? null,
          created_at: now,
          updated_at: now,
        })
        .returning();

      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async findById(id: string): Promise<TrainerAvailability | null> {
    const result = await db
      .select()
      .from(trainerAvailabilities)
      .where(eq(trainerAvailabilities.id, id))
      .limit(1);

    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findByTrainerId(trainerId: string): Promise<TrainerAvailability[]> {
    const result = await db
      .select()
      .from(trainerAvailabilities)
      .where(eq(trainerAvailabilities.trainer_id, trainerId))
      .orderBy(desc(trainerAvailabilities.date));

    return result.map((row) => this.mapToDomain(row));
  }

  async findAll(): Promise<TrainerAvailability[]> {
    const result = await db
      .select()
      .from(trainerAvailabilities)
      .orderBy(desc(trainerAvailabilities.date));
    return result.map((row) => this.mapToDomain(row));
  }

  async findByQuery(query: AvailabilityQuery): Promise<TrainerAvailability[]> {
    const conditions: any[] = [];

    if (query.trainerId) {
      conditions.push(eq(trainerAvailabilities.trainer_id, query.trainerId));
    }

    if (query.startDate) {
      conditions.push(gte(trainerAvailabilities.date, new Date(query.startDate)));
    }

    if (query.endDate) {
      conditions.push(lte(trainerAvailabilities.date, new Date(query.endDate)));
    }

    if (query.status) {
      conditions.push(eq(trainerAvailabilities.status, query.status));
    }

    const result = await db
      .select()
      .from(trainerAvailabilities)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(trainerAvailabilities.date));

    return result.map((row) => this.mapToDomain(row));
  }

  async findByDateRange(
    trainerId: string,
    startDate: string,
    endDate: string
  ): Promise<TrainerAvailability[]> {
    const result = await db
      .select()
      .from(trainerAvailabilities)
      .where(
        and(
          eq(trainerAvailabilities.trainer_id, trainerId),
          gte(trainerAvailabilities.date, new Date(startDate)),
          lte(trainerAvailabilities.date, new Date(endDate))
        )
      )
      .orderBy(desc(trainerAvailabilities.date));

    return result.map((row) => this.mapToDomain(row));
  }

  async findByStatus(
    trainerId: string,
    status: TrainerAvailability['status']
  ): Promise<TrainerAvailability[]> {
    const result = await db
      .select()
      .from(trainerAvailabilities)
      .where(
        and(
          eq(trainerAvailabilities.trainer_id, trainerId),
          eq(trainerAvailabilities.status, status)
        )
      )
      .orderBy(desc(trainerAvailabilities.date));

    return result.map((row) => this.mapToDomain(row));
  }

  async update(
    id: string,
    input: UpdateTrainerAvailabilityInput
  ): Promise<TrainerAvailability | null> {
    const now = new Date();

    try {
      const updateData: any = {
        updated_at: now,
      };

      if (input.date !== undefined) updateData.date = new Date(input.date);
      if (input.startTime !== undefined) updateData.start_time = input.startTime;
      if (input.endTime !== undefined) updateData.end_time = input.endTime;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.notes !== undefined) updateData.notes = input.notes;

      const result = await db
        .update(trainerAvailabilities)
        .set(updateData)
        .where(eq(trainerAvailabilities.id, id))
        .returning();

      if (result.length === 0) return null;
      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async markAsBooked(id: string): Promise<TrainerAvailability | null> {
    return this.update(id, { status: 'booked' });
  }

  async markAsBlocked(id: string, notes?: string): Promise<TrainerAvailability | null> {
    return this.update(id, { status: 'blocked', notes });
  }

  async delete(id: string): Promise<void> {
    await db.delete(trainerAvailabilities).where(eq(trainerAvailabilities.id, id));
  }

  async checkForConflicts(
    trainerId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeId?: string
  ): Promise<AvailabilityConflict[]> {

    // Use the PostgreSQL function for overlap detection
    const result = await db.execute<{
      id: string;
      start_time: string;
      end_time: string;
      status: string;
    }>(sql`
      SELECT id, start_time, end_time, status
      FROM check_availability_overlap(
        ${trainerId}::uuid,
        ${new Date(date)}::timestamptz,
        ${startTime}::varchar,
        ${endTime}::varchar,
        ${excludeId ?? null}::uuid
      )
    `);

    if (!result || result.length === 0) {
      return [];
    }

    // Map conflicts
    return result.map((row) => ({
      id: row.id,
      trainerId,
      trainerName: '', // Would need join with trainers table
      date,
      startTime: row.start_time,
      endTime: row.end_time,
      conflictType: 'overlap' as const,
      conflictingWith: [row.id],
    }));
  }

  async getAvailableSlots(trainerId: string, date: string): Promise<TrainerAvailability[]> {
    const result = await db
      .select()
      .from(trainerAvailabilities)
      .where(
        and(
          eq(trainerAvailabilities.trainer_id, trainerId),
          eq(trainerAvailabilities.date, new Date(date)),
          eq(trainerAvailabilities.status, 'available')
        )
      )
      .orderBy(trainerAvailabilities.start_time);

    return result.map((row) => this.mapToDomain(row));
  }

  private mapToDomain(row: typeof trainerAvailabilities.$inferSelect): TrainerAvailability {
    return {
      id: row.id,
      trainerId: row.trainer_id,
      date: row.date.toISOString().split('T')[0], // YYYY-MM-DD
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status as 'available' | 'unavailable' | 'booked' | 'blocked',
      notes: row.notes ?? undefined,
      recurringPattern: row.recurring_pattern as
        | {
            type: 'daily' | 'weekly' | 'monthly' | 'yearly';
            interval: number;
            endDate?: string;
          }
        | undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

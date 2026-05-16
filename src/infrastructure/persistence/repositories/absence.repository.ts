import { eq, and, gte, lte, desc, ne } from 'drizzle-orm';
import { getDb } from '../client';
import { trainerAbsences } from '../schema';
import type { IAbsenceRepository } from '@/domain/repositories/absence-repository.interface';
import type {
  Absence,
  CreateAbsenceInput,
  UpdateAbsenceInput,
} from '@/domain/entities/absence.entity';
import { parsePostgresError } from '@/lib/errors/database-errors';

/**
 * Drizzle ORM implementation of the Absence Repository
 * Manages trainer absences with multi-tenant isolation and approval workflow
 */
export class DrizzleAbsenceRepository implements IAbsenceRepository {
  async create(input: CreateAbsenceInput, clubId: string): Promise<Absence> {
    const db = getDb();
    const now = new Date();

    try {
      const result = await db
        .insert(trainerAbsences)
        .values({
          trainer_id: input.trainerId,
          club_id: clubId,
          trainer_name: input.trainerName,
          type: input.type,
          start_date: new Date(input.startDate),
          end_date: new Date(input.endDate),
          status: 'pending',
          reason: input.reason,
          notes: input.notes,
          created_at: now,
          updated_at: now,
        })
        .returning();

      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async findById(id: string, clubId: string): Promise<Absence | null> {
    const db = getDb();
    const result = await db
      .select()
      .from(trainerAbsences)
      .where(and(eq(trainerAbsences.id, id), eq(trainerAbsences.club_id, clubId)))
      .limit(1);

    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findByTrainerId(trainerId: string, clubId: string): Promise<Absence[]> {
    const db = getDb();
    const result = await db
      .select()
      .from(trainerAbsences)
      .where(and(eq(trainerAbsences.trainer_id, trainerId), eq(trainerAbsences.club_id, clubId)))
      .orderBy(desc(trainerAbsences.start_date));

    return result.map((row) => this.mapToDomain(row));
  }

  async findAll(clubId: string): Promise<Absence[]> {
    const db = getDb();
    const result = await db
      .select()
      .from(trainerAbsences)
      .where(eq(trainerAbsences.club_id, clubId))
      .orderBy(desc(trainerAbsences.start_date));

    return result.map((row) => this.mapToDomain(row));
  }

  async findByStatus(status: Absence['status'], clubId: string): Promise<Absence[]> {
    const db = getDb();
    const result = await db
      .select()
      .from(trainerAbsences)
      .where(and(eq(trainerAbsences.status, status), eq(trainerAbsences.club_id, clubId)))
      .orderBy(desc(trainerAbsences.start_date));

    return result.map((row) => this.mapToDomain(row));
  }

  async findByType(type: Absence['type'], clubId: string): Promise<Absence[]> {
    const db = getDb();
    const result = await db
      .select()
      .from(trainerAbsences)
      .where(and(eq(trainerAbsences.type, type), eq(trainerAbsences.club_id, clubId)))
      .orderBy(desc(trainerAbsences.start_date));

    return result.map((row) => this.mapToDomain(row));
  }

  async findByDateRange(startDate: string, endDate: string, clubId: string): Promise<Absence[]> {
    const db = getDb();

    // Find absences that overlap with the query range
    // Overlap occurs when: (absence_start <= range_end) AND (absence_end >= range_start)
    const result = await db
      .select()
      .from(trainerAbsences)
      .where(
        and(
          eq(trainerAbsences.club_id, clubId),
          lte(trainerAbsences.start_date, new Date(endDate)),
          gte(trainerAbsences.end_date, new Date(startDate))
        )
      )
      .orderBy(desc(trainerAbsences.start_date));

    return result.map((row) => this.mapToDomain(row));
  }

  async findActiveForDate(date: string, clubId: string): Promise<Absence[]> {
    const db = getDb();
    const targetDate = new Date(date);

    const result = await db
      .select()
      .from(trainerAbsences)
      .where(
        and(
          eq(trainerAbsences.club_id, clubId),
          eq(trainerAbsences.status, 'approved'),
          lte(trainerAbsences.start_date, targetDate),
          gte(trainerAbsences.end_date, targetDate)
        )
      )
      .orderBy(desc(trainerAbsences.start_date));

    return result.map((row) => this.mapToDomain(row));
  }

  async findConflicting(
    trainerId: string,
    startDate: string,
    endDate: string,
    clubId: string,
    excludeId?: string
  ): Promise<Absence[]> {
    const db = getDb();

    const conditions = [
      eq(trainerAbsences.trainer_id, trainerId),
      eq(trainerAbsences.club_id, clubId),
      eq(trainerAbsences.status, 'approved'),
      // Check for date overlap
      lte(trainerAbsences.start_date, new Date(endDate)),
      gte(trainerAbsences.end_date, new Date(startDate)),
    ];

    // Exclude specific absence (for updates)
    if (excludeId) {
      conditions.push(ne(trainerAbsences.id, excludeId));
    }

    const result = await db
      .select()
      .from(trainerAbsences)
      .where(and(...conditions))
      .orderBy(desc(trainerAbsences.start_date));

    return result.map((row) => this.mapToDomain(row));
  }

  async update(id: string, input: UpdateAbsenceInput, clubId: string): Promise<Absence | null> {
    const db = getDb();
    const now = new Date();

    try {
      const updateData: any = {
        updated_at: now,
      };

      if (input.type !== undefined) updateData.type = input.type;
      if (input.startDate !== undefined) updateData.start_date = new Date(input.startDate);
      if (input.endDate !== undefined) updateData.end_date = new Date(input.endDate);
      if (input.status !== undefined) updateData.status = input.status;
      if (input.reason !== undefined) updateData.reason = input.reason;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.approvedBy !== undefined) updateData.approved_by = input.approvedBy;
      if (input.approvedAt !== undefined) updateData.approved_at = new Date(input.approvedAt);

      const result = await db
        .update(trainerAbsences)
        .set(updateData)
        .where(and(eq(trainerAbsences.id, id), eq(trainerAbsences.club_id, clubId)))
        .returning();

      if (result.length === 0) return null;
      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async approve(id: string, approvedBy: string, clubId: string): Promise<Absence | null> {
    return this.update(
      id,
      {
        status: 'approved',
        approvedBy,
        approvedAt: new Date().toISOString(),
      },
      clubId
    );
  }

  async reject(id: string, approvedBy: string, clubId: string): Promise<Absence | null> {
    return this.update(
      id,
      {
        status: 'rejected',
        approvedBy,
        approvedAt: new Date().toISOString(),
      },
      clubId
    );
  }

  async delete(id: string, clubId: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .delete(trainerAbsences)
      .where(and(eq(trainerAbsences.id, id), eq(trainerAbsences.club_id, clubId)))
      .returning();

    return result.length > 0;
  }

  /**
   * Map database row to domain entity
   */
  private mapToDomain(row: typeof trainerAbsences.$inferSelect): Absence {
    return {
      id: row.id,
      trainerId: row.trainer_id,
      trainerName: row.trainer_name,
      type: row.type as 'sick' | 'vacation' | 'personal' | 'other',
      startDate: this.formatDate(row.start_date),
      endDate: this.formatDate(row.end_date),
      status: row.status as 'pending' | 'approved' | 'rejected',
      reason: row.reason ?? undefined,
      notes: row.notes ?? undefined,
      approvedBy: row.approved_by ?? undefined,
      approvedAt: row.approved_at?.toISOString(),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Format date to YYYY-MM-DD string
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}

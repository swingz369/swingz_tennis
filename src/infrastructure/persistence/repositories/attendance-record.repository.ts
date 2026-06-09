import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '../db';
import { attendanceRecords } from '../schema';
import type {
  AttendanceRecord,
  CreateAttendanceRecordInput,
  UpdateAttendanceRecordInput,
  AttendanceRecordRepository,
} from '@/domain/repositories/hours-log-repository.interface';
import { parsePostgresError } from '@/lib/errors/database-errors';

export class DrizzleAttendanceRecordRepository implements AttendanceRecordRepository {
  async create(input: CreateAttendanceRecordInput): Promise<AttendanceRecord> {
    const now = new Date();

    try {
      const result = await db
        .insert(attendanceRecords)
        .values({
          session_id: input.sessionId,
          trainer_id: input.trainerId,
          trainer_name: input.trainerName,
          participant_id: input.participantId,
          participant_name: input.participantName,
          date: new Date(input.date),
          status: input.status,
          check_in_time: input.checkInTime ?? null,
          check_out_time: input.checkOutTime ?? null,
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

  async findById(id: string): Promise<AttendanceRecord | null> {
    const result = await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.id, id))
      .limit(1);

    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findBySessionId(sessionId: string): Promise<AttendanceRecord[]> {
    const result = await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.session_id, sessionId))
      .orderBy(desc(attendanceRecords.date));

    return result.map((row) => this.mapToDomain(row));
  }

  async findByTrainerId(trainerId: string): Promise<AttendanceRecord[]> {
    const result = await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.trainer_id, trainerId))
      .orderBy(desc(attendanceRecords.date));

    return result.map((row) => this.mapToDomain(row));
  }

  async findByParticipantId(participantId: string): Promise<AttendanceRecord[]> {
    const result = await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.participant_id, participantId))
      .orderBy(desc(attendanceRecords.date));

    return result.map((row) => this.mapToDomain(row));
  }

  async findAll(): Promise<AttendanceRecord[]> {
    const result = await db.select().from(attendanceRecords).orderBy(desc(attendanceRecords.date));
    return result.map((row) => this.mapToDomain(row));
  }

  async findByDateRange(startDate: string, endDate: string): Promise<AttendanceRecord[]> {
    const result = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          gte(attendanceRecords.date, new Date(startDate)),
          lte(attendanceRecords.date, new Date(endDate))
        )
      )
      .orderBy(desc(attendanceRecords.date));

    return result.map((row) => this.mapToDomain(row));
  }

  async update(id: string, input: UpdateAttendanceRecordInput): Promise<AttendanceRecord | null> {
    const now = new Date();

    try {
      const updateData: Partial<typeof attendanceRecords.$inferInsert> = {
        updated_at: now,
      };

      if (input.status !== undefined) updateData.status = input.status;
      if (input.checkInTime !== undefined) updateData.check_in_time = input.checkInTime;
      if (input.checkOutTime !== undefined) updateData.check_out_time = input.checkOutTime;
      if (input.notes !== undefined) updateData.notes = input.notes;

      const result = await db
        .update(attendanceRecords)
        .set(updateData)
        .where(eq(attendanceRecords.id, id))
        .returning();

      if (result.length === 0) return null;
      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async delete(id: string): Promise<void> {
    await db.delete(attendanceRecords).where(eq(attendanceRecords.id, id));
  }

  private mapToDomain(row: typeof attendanceRecords.$inferSelect): AttendanceRecord {
    return {
      id: row.id,
      sessionId: row.session_id,
      trainerId: row.trainer_id,
      trainerName: row.trainer_name,
      participantId: row.participant_id,
      participantName: row.participant_name,
      date: row.date.toISOString().split('T')[0], // YYYY-MM-DD
      status: row.status as 'present' | 'absent' | 'late' | 'excused',
      checkInTime: row.check_in_time ?? undefined,
      checkOutTime: row.check_out_time ?? undefined,
      notes: row.notes ?? undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

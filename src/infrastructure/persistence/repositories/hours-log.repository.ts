import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '../db';
import { hoursLogs } from '../schema';
import type {
  HoursLog,
  CreateHoursLogInput,
  UpdateHoursLogInput,
  HoursSummary,
  HoursLogRepository,
} from '@/domain/repositories/hours-log-repository.interface';
import { parsePostgresError } from '@/lib/errors/database-errors';

export class DrizzleHoursLogRepository implements HoursLogRepository {
  async create(input: CreateHoursLogInput): Promise<HoursLog> {
    const duration = this.calculateDuration(input.startTime, input.endTime);
    const now = new Date();

    try {
      const result = await db
        .insert(hoursLogs)
        .values({
          trainer_id: input.trainerId,
          trainer_name: input.trainerName,
          session_id: input.sessionId ?? null,
          date: new Date(input.date),
          start_time: input.startTime,
          end_time: input.endTime,
          duration,
          type: input.type,
          status: 'pending',
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

  async findById(id: string): Promise<HoursLog | null> {
    const result = await db.select().from(hoursLogs).where(eq(hoursLogs.id, id)).limit(1);

    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findByTrainerId(trainerId: string): Promise<HoursLog[]> {
    const result = await db
      .select()
      .from(hoursLogs)
      .where(eq(hoursLogs.trainer_id, trainerId))
      .orderBy(desc(hoursLogs.date));

    return result.map((row) => this.mapToDomain(row));
  }

  async findAll(): Promise<HoursLog[]> {
    const result = await db.select().from(hoursLogs).orderBy(desc(hoursLogs.date));
    return result.map((row) => this.mapToDomain(row));
  }

  async findByDateRange(startDate: string, endDate: string): Promise<HoursLog[]> {
    const result = await db
      .select()
      .from(hoursLogs)
      .where(and(gte(hoursLogs.date, new Date(startDate)), lte(hoursLogs.date, new Date(endDate))))
      .orderBy(desc(hoursLogs.date));

    return result.map((row) => this.mapToDomain(row));
  }

  async findByStatus(status: HoursLog['status']): Promise<HoursLog[]> {
    const result = await db
      .select()
      .from(hoursLogs)
      .where(eq(hoursLogs.status, status))
      .orderBy(desc(hoursLogs.date));

    return result.map((row) => this.mapToDomain(row));
  }

  async update(id: string, input: UpdateHoursLogInput): Promise<HoursLog | null> {
    const now = new Date();

    try {
      const updateData: any = {
        updated_at: now,
      };

      if (input.startTime !== undefined) updateData.start_time = input.startTime;
      if (input.endTime !== undefined) updateData.end_time = input.endTime;
      if (input.type !== undefined) updateData.type = input.type;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.approvedBy !== undefined) updateData.approved_by = input.approvedBy;
      if (input.approvedAt !== undefined) updateData.approved_at = new Date(input.approvedAt);
      if (input.rejectionReason !== undefined) updateData.rejection_reason = input.rejectionReason;

      // Recalculate duration if times changed
      if (input.startTime || input.endTime) {
        const existing = await this.findById(id);
        if (existing) {
          const startTime = input.startTime ?? existing.startTime;
          const endTime = input.endTime ?? existing.endTime;
          updateData.duration = this.calculateDuration(startTime, endTime);
        }
      }

      const result = await db
        .update(hoursLogs)
        .set(updateData)
        .where(eq(hoursLogs.id, id))
        .returning();

      if (result.length === 0) return null;
      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async approve(id: string, approvedBy: string): Promise<HoursLog | null> {
    return this.update(id, {
      status: 'approved',
      approvedBy,
      approvedAt: new Date().toISOString(),
    });
  }

  async reject(id: string, approvedBy: string, reason?: string): Promise<HoursLog | null> {
    return this.update(id, {
      status: 'rejected',
      approvedBy,
      approvedAt: new Date().toISOString(),
      rejectionReason: reason,
    });
  }

  async delete(id: string): Promise<void> {
    await db.delete(hoursLogs).where(eq(hoursLogs.id, id));
  }

  async getSummaryForTrainer(trainerId: string): Promise<HoursSummary> {
    const logs = await this.findByTrainerId(trainerId);

    const totalMinutes = logs.reduce((sum, log) => sum + log.duration, 0);
    const trainingMinutes = logs
      .filter((log) => log.type === 'training')
      .reduce((sum, log) => sum + log.duration, 0);
    const preparationMinutes = logs
      .filter((log) => log.type === 'preparation')
      .reduce((sum, log) => sum + log.duration, 0);
    const meetingMinutes = logs
      .filter((log) => log.type === 'meeting')
      .reduce((sum, log) => sum + log.duration, 0);
    const otherMinutes = logs
      .filter((log) => log.type === 'other')
      .reduce((sum, log) => sum + log.duration, 0);

    const pendingMinutes = logs
      .filter((log) => log.status === 'pending')
      .reduce((sum, log) => sum + log.duration, 0);
    const approvedMinutes = logs
      .filter((log) => log.status === 'approved')
      .reduce((sum, log) => sum + log.duration, 0);
    const rejectedMinutes = logs
      .filter((log) => log.status === 'rejected')
      .reduce((sum, log) => sum + log.duration, 0);

    const trainerName = logs.length > 0 ? logs[0].trainerName : 'Unknown';

    return {
      trainerId,
      trainerName,
      totalHours: totalMinutes / 60,
      trainingHours: trainingMinutes / 60,
      preparationHours: preparationMinutes / 60,
      meetingHours: meetingMinutes / 60,
      otherHours: otherMinutes / 60,
      pendingHours: pendingMinutes / 60,
      approvedHours: approvedMinutes / 60,
      rejectedHours: rejectedMinutes / 60,
    };
  }

  async getAllSummaries(): Promise<HoursSummary[]> {
    // Get distinct trainer IDs
    const result = await db
      .select({
        trainer_id: hoursLogs.trainer_id,
      })
      .from(hoursLogs)
      .groupBy(hoursLogs.trainer_id);

    const summaries: HoursSummary[] = [];
    for (const row of result) {
      const summary = await this.getSummaryForTrainer(row.trainer_id);
      summaries.push(summary);
    }

    return summaries;
  }

  private calculateDuration(startTime: string, endTime: string): number {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);

    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;

    return endTotalMinutes - startTotalMinutes;
  }

  private mapToDomain(row: typeof hoursLogs.$inferSelect): HoursLog {
    return {
      id: row.id,
      trainerId: row.trainer_id,
      trainerName: row.trainer_name,
      sessionId: row.session_id ?? undefined,
      date: row.date.toISOString().split('T')[0], // YYYY-MM-DD
      startTime: row.start_time,
      endTime: row.end_time,
      duration: row.duration,
      type: row.type as 'training' | 'preparation' | 'meeting' | 'other',
      status: row.status as 'pending' | 'approved' | 'rejected',
      notes: row.notes ?? undefined,
      approvedBy: row.approved_by ?? undefined,
      approvedAt: row.approved_at?.toISOString(),
      rejectionReason: row.rejection_reason ?? undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

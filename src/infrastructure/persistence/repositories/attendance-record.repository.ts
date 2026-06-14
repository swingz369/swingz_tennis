import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { attendanceRecords } from '../schema';
import type {
  AttendanceRecord,
  CreateAttendanceRecordInput,
  UpdateAttendanceRecordInput,
  AttendanceRecordRepository,
  AttendanceHoursSummary,
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
      if (input.trainerConfirmed !== undefined)
        updateData.trainer_confirmed = input.trainerConfirmed;
      if (input.trainerConfirmedAt !== undefined)
        updateData.trainer_confirmed_at = input.trainerConfirmedAt
          ? new Date(input.trainerConfirmedAt)
          : null;
      if (input.memberStatus !== undefined) updateData.member_status = input.memberStatus;
      if (input.memberConfirmedAt !== undefined)
        updateData.member_confirmed_at = input.memberConfirmedAt
          ? new Date(input.memberConfirmedAt)
          : null;
      if (input.disputeReason !== undefined) updateData.dispute_reason = input.disputeReason;
      if (input.disputeResolvedAt !== undefined)
        updateData.dispute_resolved_at = input.disputeResolvedAt
          ? new Date(input.disputeResolvedAt)
          : null;
      if (input.disputeResolvedBy !== undefined)
        updateData.dispute_resolved_by = input.disputeResolvedBy;
      if (input.durationMinutes !== undefined) updateData.duration_minutes = input.durationMinutes;

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

  async batchConfirmByTrainer(ids: string[], _trainerId: string): Promise<number> {
    if (ids.length === 0) return 0;
    const now = new Date();
    try {
      const result = await db
        .update(attendanceRecords)
        .set({ trainer_confirmed: true, trainer_confirmed_at: now, updated_at: now })
        .where(sql`${attendanceRecords.id} = ANY(${ids})`)
        .returning();
      return result.length;
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async memberConfirm(id: string, participantId: string): Promise<AttendanceRecord | null> {
    const now = new Date();
    try {
      const result = await db
        .update(attendanceRecords)
        .set({ member_status: 'confirmed', member_confirmed_at: now, updated_at: now })
        .where(
          and(eq(attendanceRecords.id, id), eq(attendanceRecords.participant_id, participantId))
        )
        .returning();
      if (result.length === 0) return null;
      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async memberDispute(
    id: string,
    participantId: string,
    reason: string
  ): Promise<AttendanceRecord | null> {
    const now = new Date();
    try {
      const result = await db
        .update(attendanceRecords)
        .set({
          member_status: 'disputed',
          member_confirmed_at: now,
          dispute_reason: reason,
          updated_at: now,
        })
        .where(
          and(eq(attendanceRecords.id, id), eq(attendanceRecords.participant_id, participantId))
        )
        .returning();
      if (result.length === 0) return null;
      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async resolveDispute(
    id: string,
    resolvedBy: string,
    resolution: 'confirmed' | 'absent'
  ): Promise<AttendanceRecord | null> {
    const now = new Date();
    try {
      const result = await db
        .update(attendanceRecords)
        .set({
          member_status: resolution === 'confirmed' ? 'confirmed' : 'pending',
          dispute_resolved_at: now,
          dispute_resolved_by: resolvedBy,
          status: resolution === 'absent' ? 'absent' : undefined,
          updated_at: now,
        })
        .where(eq(attendanceRecords.id, id))
        .returning();
      if (result.length === 0) return null;
      return this.mapToDomain(result[0]);
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async getHoursSummaryForMember(memberId: string): Promise<AttendanceHoursSummary | null> {
    try {
      const result = await db
        .select({
          memberId: attendanceRecords.participant_id,
          totalSessions: sql<number>`count(*)::int`,
          attendedSessions: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'present')::int`,
          missedSessions: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'absent')::int`,
          excusedSessions: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'excused')::int`,
          lateSessions: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'late')::int`,
          trainerConfirmedCount: sql<number>`count(*) filter (where ${attendanceRecords.trainer_confirmed} = true)::int`,
          memberConfirmedCount: sql<number>`count(*) filter (where ${attendanceRecords.member_status} = 'confirmed')::int`,
          disputedCount: sql<number>`count(*) filter (where ${attendanceRecords.member_status} = 'disputed')::int`,
          pendingConfirmationCount: sql<number>`count(*) filter (where ${attendanceRecords.member_status} = 'pending')::int`,
          totalAttendedMinutes: sql<number>`coalesce(sum(${attendanceRecords.duration_minutes}) filter (where ${attendanceRecords.status} in ('present', 'late')), 0)::int`,
          totalScheduledMinutes: sql<number>`coalesce(sum(${attendanceRecords.duration_minutes}), 0)::int`,
        })
        .from(attendanceRecords)
        .where(eq(attendanceRecords.participant_id, memberId))
        .groupBy(attendanceRecords.participant_id);

      if (result.length === 0) return null;
      const r = result[0];
      return {
        memberId: r.memberId,
        memberName: '',
        totalSessions: r.totalSessions,
        attendedSessions: r.attendedSessions,
        missedSessions: r.missedSessions,
        excusedSessions: r.excusedSessions,
        lateSessions: r.lateSessions,
        trainerConfirmedCount: r.trainerConfirmedCount,
        memberConfirmedCount: r.memberConfirmedCount,
        disputedCount: r.disputedCount,
        pendingConfirmationCount: r.pendingConfirmationCount,
        totalAttendedMinutes: r.totalAttendedMinutes,
        totalScheduledMinutes: r.totalScheduledMinutes,
        attendanceRate:
          r.totalSessions > 0
            ? Math.round(((r.attendedSessions + r.lateSessions) * 1000) / r.totalSessions) / 10
            : 0,
      };
    } catch (error) {
      throw parsePostgresError(error);
    }
  }

  async getHoursSummaryForClub(_clubId: string): Promise<AttendanceHoursSummary[]> {
    try {
      const result = await db
        .select({
          memberId: attendanceRecords.participant_id,
          totalSessions: sql<number>`count(*)::int`,
          attendedSessions: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'present')::int`,
          missedSessions: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'absent')::int`,
          excusedSessions: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'excused')::int`,
          lateSessions: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'late')::int`,
          trainerConfirmedCount: sql<number>`count(*) filter (where ${attendanceRecords.trainer_confirmed} = true)::int`,
          memberConfirmedCount: sql<number>`count(*) filter (where ${attendanceRecords.member_status} = 'confirmed')::int`,
          disputedCount: sql<number>`count(*) filter (where ${attendanceRecords.member_status} = 'disputed')::int`,
          pendingConfirmationCount: sql<number>`count(*) filter (where ${attendanceRecords.member_status} = 'pending')::int`,
          totalAttendedMinutes: sql<number>`coalesce(sum(${attendanceRecords.duration_minutes}) filter (where ${attendanceRecords.status} in ('present', 'late')), 0)::int`,
          totalScheduledMinutes: sql<number>`coalesce(sum(${attendanceRecords.duration_minutes}), 0)::int`,
        })
        .from(attendanceRecords)
        .groupBy(attendanceRecords.participant_id);

      return result.map((r) => ({
        memberId: r.memberId,
        memberName: '',
        totalSessions: r.totalSessions,
        attendedSessions: r.attendedSessions,
        missedSessions: r.missedSessions,
        excusedSessions: r.excusedSessions,
        lateSessions: r.lateSessions,
        trainerConfirmedCount: r.trainerConfirmedCount,
        memberConfirmedCount: r.memberConfirmedCount,
        disputedCount: r.disputedCount,
        pendingConfirmationCount: r.pendingConfirmationCount,
        totalAttendedMinutes: r.totalAttendedMinutes,
        totalScheduledMinutes: r.totalScheduledMinutes,
        attendanceRate:
          r.totalSessions > 0
            ? Math.round(((r.attendedSessions + r.lateSessions) * 1000) / r.totalSessions) / 10
            : 0,
      }));
    } catch (error) {
      throw parsePostgresError(error);
    }
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
      trainerConfirmed: row.trainer_confirmed ?? false,
      trainerConfirmedAt: row.trainer_confirmed_at?.toISOString(),
      memberStatus: (row.member_status ?? 'pending') as 'pending' | 'confirmed' | 'disputed',
      memberConfirmedAt: row.member_confirmed_at?.toISOString(),
      disputeReason: row.dispute_reason ?? undefined,
      disputeResolvedAt: row.dispute_resolved_at?.toISOString(),
      disputeResolvedBy: row.dispute_resolved_by ?? undefined,
      durationMinutes: row.duration_minutes ?? undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

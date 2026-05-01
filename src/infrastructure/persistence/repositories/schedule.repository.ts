import { eq, gte, lte, sql, and, inArray } from 'drizzle-orm';
import { db } from '../client';
import { schedules, sessions, trainingGroups } from '../schema';
import { Schedule } from '@/domain/entities/schedule';
import { ScheduleId, ClubId, ScheduleWeek, TrainerId, SessionId } from '@/domain/value-objects';
import type { ScheduleRepository } from '@/domain/repositories/schedule-repository.interface';
import type { Session } from '@/domain/entities/schedule';
import { TimeSlot } from '@/domain/value-objects/timeslot';

export class DrizzleScheduleRepository implements ScheduleRepository {
  async findById(id: ScheduleId): Promise<Schedule | null> {
    const result = await db
      .select()
      .from(schedules)
      .where(eq(schedules.id, id.getValue()))
      .limit(1);
    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findByClubId(clubId: ClubId): Promise<Schedule | null> {
    const result = await db
      .select()
      .from(schedules)
      .where(eq(schedules.club_id, clubId.getValue()))
      .limit(1);
    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findByWeek(clubId: ClubId, week: ScheduleWeek): Promise<Schedule | null> {
    const result = await db
      .select()
      .from(schedules)
      .where(
        and(eq(schedules.club_id, clubId.getValue()), eq(schedules.season_year, week.getYear()))
      )
      .limit(1);
    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async save(schedule: Schedule): Promise<void> {
    const now = new Date();
    const scheduleData = {
      id: schedule.getId().getValue(),
      club_id: schedule.getClubId().getValue(),
      season_type: schedule.getSeason().type,
      season_year: schedule.getSeason().year,
      season_start_date: schedule.getSeason().startDate,
      season_end_date: schedule.getSeason().endDate,
      updated_at: now,
    };

    const existing = await this.findById(schedule.getId());
    if (existing) {
      await db
        .update(schedules)
        .set(scheduleData)
        .where(eq(schedules.id, schedule.getId().getValue()));
    } else {
      await db.insert(schedules).values(scheduleData);
    }
  }

  async delete(id: ScheduleId): Promise<void> {
    await db.delete(sessions).where(eq(sessions.schedule_id, id.getValue()));
    await db.delete(trainingGroups).where(eq(trainingGroups.schedule_id, id.getValue()));
    await db.delete(schedules).where(eq(schedules.id, id.getValue()));
  }

  async exists(id: ScheduleId): Promise<boolean> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(schedules)
      .where(eq(schedules.id, id.getValue()));
    return result[0]?.count > 0;
  }

  async findSessionsForTrainer(
    trainerId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Session[]> {
    const result = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.trainer_id, trainerId),
          gte(sessions.timeslot_start, startDate),
          lte(sessions.timeslot_end, endDate)
        )
      );
    return result.map((row: any) => {
      const session: Session = {
        id: row.id,
        trainerId: TrainerId.fromString(row.trainer_id),
        groupIds: row.group_ids,
        week: ScheduleWeek.fromDate(row.timeslot_start),
        timeslot: new TimeSlot(new Date(row.timeslot_start), new Date(row.timeslot_end)),
        maxParticipants: row.max_participants,
        ...(row.court_id ? { courtId: row.court_id } : {}),
      };
      if (row.notes !== null && row.notes !== undefined) {
        session.notes = row.notes;
      }
      return session;
    });
  }

  async getSessionDetails(sessionId: SessionId): Promise<{
    clubId: ClubId;
    scheduleId: ScheduleId;
    timeslot: TimeSlot;
    maxParticipants: number;
  } | null> {
    const result = await db
      .select({
        clubId: schedules.club_id,
        scheduleId: sessions.schedule_id,
        timeslotStart: sessions.timeslot_start,
        timeslotEnd: sessions.timeslot_end,
        maxParticipants: sessions.max_participants,
      })
      .from(sessions)
      .innerJoin(schedules, eq(sessions.schedule_id, schedules.id))
      .where(eq(sessions.id, sessionId.getValue()))
      .limit(1);
    if (result.length === 0) return null;
    const row = result[0];
    return {
      clubId: ClubId.fromString(row.clubId),
      scheduleId: ScheduleId.fromString(row.scheduleId),
      timeslot: new TimeSlot(new Date(row.timeslotStart), new Date(row.timeslotEnd)),
      maxParticipants: row.maxParticipants,
    };
  }

  async findSessionsByClubId(clubId: ClubId): Promise<Session[]> {
    // Get all schedule IDs for this club
    const scheduleRows = await db
      .select({ id: schedules.id })
      .from(schedules)
      .where(eq(schedules.club_id, clubId.getValue()));
    const scheduleIds = scheduleRows.map((row: any) => row.id);
    if (scheduleIds.length === 0) return [];

    const result = await db
      .select()
      .from(sessions)
      .where(inArray(sessions.schedule_id, scheduleIds));

    return result.map((row: any) => {
      const session: Session = {
        id: row.id,
        trainerId: TrainerId.fromString(row.trainer_id),
        groupIds: row.group_ids,
        week: ScheduleWeek.fromDate(row.timeslot_start),
        timeslot: new TimeSlot(new Date(row.timeslot_start), new Date(row.timeslot_end)),
        maxParticipants: row.max_participants,
        ...(row.court_id ? { courtId: row.court_id } : {}),
      };
      if (row.notes !== null && row.notes !== undefined) {
        session.notes = row.notes;
      }
      return session;
    });
  }

  private mapToDomain(row: typeof schedules.$inferSelect): Schedule {
    return Schedule.reconstitute(
      ScheduleId.fromString(row.id),
      ClubId.fromString(row.club_id),
      {
        type: row.season_type as Schedule['season']['type'],
        year: row.season_year,
        startDate: new Date(row.season_start_date),
        endDate: new Date(row.season_end_date),
      },
      [],
      [],
      new Date(row.created_at),
      new Date(row.updated_at)
    );
  }
}

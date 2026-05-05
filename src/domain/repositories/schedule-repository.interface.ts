import type { Schedule } from '../entities/schedule';
import type { ScheduleId, ClubId, SessionId } from '../value-objects';
import type { ScheduleWeek } from '../value-objects';
import type { Session } from '../entities/schedule';
import type { TimeSlot } from '../value-objects/timeslot';

export interface ScheduleRepository {
  findById(id: ScheduleId): Promise<Schedule | null>;
  findByClubId(clubId: ClubId): Promise<Schedule | null>;
  findByWeek(clubId: ClubId, week: ScheduleWeek): Promise<Schedule | null>;
  save(schedule: Schedule): Promise<void>;
  delete(id: ScheduleId): Promise<void>;
  exists(id: ScheduleId): Promise<boolean>;
  findSessionsForTrainer(trainerId: string, startDate: Date, endDate: Date): Promise<Session[]>;
  findSessionsByClubId(clubId: ClubId): Promise<Session[]>;
  getSessionDetails(sessionId: SessionId): Promise<{
    clubId: ClubId;
    scheduleId: ScheduleId;
    timeslot: TimeSlot;
    maxParticipants: number;
  } | null>;
  getSessionDetailsByIds(sessionIds: SessionId[]): Promise<
    Map<
      string,
      {
        clubId: ClubId;
        scheduleId: ScheduleId;
        timeslot: TimeSlot;
        maxParticipants: number;
        trainerId?: string;
      }
    >
  >;
}

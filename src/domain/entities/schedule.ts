import { ScheduleId, ClubId, TrainerId } from '../value-objects';
import { TimeSlot, ScheduleWeek } from '../value-objects';
import { MemberId } from '../value-objects';

export interface Session {
  id: string;
  trainerId: TrainerId;
  groupIds: string[];
  week: ScheduleWeek;
  timeslot: TimeSlot;
  courtId?: string;
  maxParticipants: number;
  notes?: string;
}

export interface TrainingGroup {
  id: string;
  name: string;
  memberIds: MemberId[];
  level: 'beginner' | 'intermediate' | 'advanced' | 'elite';
  ageGroup: 'junior' | 'senior';
  isActive: boolean;
}

export type SeasonType = 'spring' | 'summer' | 'autumn' | 'winter' | 'year-round';

export class Schedule {
  private readonly id: ScheduleId;
  private clubId: ClubId;
  private season: {
    type: SeasonType;
    year: number;
    startDate: Date;
    endDate: Date;
  };
  private trainingGroups: Map<string, TrainingGroup>;
  private sessions: Map<string, Session>;
  private createdAt: Date;
  private updatedAt: Date;

  private constructor(id: ScheduleId, clubId: ClubId, season: Schedule['season']) {
    this.id = id;
    this.clubId = clubId;
    this.season = season;
    this.trainingGroups = new Map();
    this.sessions = new Map();
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  public static create(
    clubId: ClubId,
    seasonType: SeasonType,
    year: number,
    startDate: Date,
    endDate: Date
  ): Schedule {
    if (!clubId) {
      throw new Error('ClubId is required');
    }
    if (startDate >= endDate) {
      throw new Error('Season start date must be before end date');
    }
    return new Schedule(ScheduleId.create(), clubId, {
      type: seasonType,
      year,
      startDate,
      endDate,
    });
  }

  public static reconstitute(
    id: ScheduleId,
    clubId: ClubId,
    season: Schedule['season'],
    trainingGroups: TrainingGroup[],
    sessions: Session[],
    createdAt: Date,
    updatedAt: Date
  ): Schedule {
    const schedule = new Schedule(id, clubId, season);
    schedule.createdAt = createdAt;
    schedule.updatedAt = updatedAt;
    schedule.trainingGroups = new Map(trainingGroups.map((g) => [g.id, g]));
    schedule.sessions = new Map(sessions.map((s) => [s.id, s]));
    return schedule;
  }

  public getId(): ScheduleId {
    return this.id;
  }

  public getClubId(): ClubId {
    return this.clubId;
  }

  public getSeason(): Schedule['season'] {
    return { ...this.season };
  }

  public getTrainingGroups(): TrainingGroup[] {
    return Array.from(this.trainingGroups.values()).filter((g) => g.isActive);
  }

  public addTrainingGroup(group: TrainingGroup): void {
    if (this.trainingGroups.has(group.id)) {
      throw new Error('Training group already exists');
    }
    this.trainingGroups.set(group.id, group);
    this.updatedAt = new Date();
  }

  public updateTrainingGroup(id: string, updates: Partial<Omit<TrainingGroup, 'id'>>): void {
    const group = this.trainingGroups.get(id);
    if (!group) {
      throw new Error('Training group not found');
    }
    this.trainingGroups.set(id, { ...group, ...updates } as TrainingGroup);
    this.updatedAt = new Date();
  }

  public removeTrainingGroup(id: string): void {
    if (!this.trainingGroups.has(id)) {
      throw new Error('Training group not found');
    }
    this.trainingGroups.set(id, { ...this.trainingGroups.get(id)!, isActive: false });
    this.updatedAt = new Date();
  }

  public getSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  public getSessionsForWeek(week: ScheduleWeek): Session[] {
    return this.getSessions().filter((s) => s.week.equals(week));
  }

  public addSession(session: Session): void {
    if (this.sessions.has(session.id)) {
      throw new Error('Session already exists');
    }

    this.validateSession(session);
    this.sessions.set(session.id, session);
    this.updatedAt = new Date();
  }

  private validateSession(session: Session): void {
    const currentSessions = this.getSessionsForWeek(session.week);

    for (const existing of currentSessions) {
      const trainerConflict =
        existing.trainerId.equals(session.trainerId) &&
        existing.timeslot.overlaps(session.timeslot);

      if (trainerConflict && existing.id !== session.id) {
        throw new Error(
          `Trainer double booking conflict: trainer is already scheduled at ${existing.timeslot}`
        );
      }

      if (session.courtId && existing.courtId === session.courtId) {
        if (existing.timeslot.overlaps(session.timeslot)) {
          throw new Error(
            `Court double booking conflict: court ${session.courtId} is already booked`
          );
        }
      }
    }

    const trainerTotalHours = currentSessions
      .filter((s) => s.trainerId.equals(session.trainerId))
      .reduce((sum, s) => sum + s.timeslot.getDurationMinutes(), 0);

    const newSessionHours = session.timeslot.getDurationMinutes();
    if (trainerTotalHours + newSessionHours > 40 * 60) {
      throw new Error('Trainer exceeds maximum weekly hours (40)');
    }
  }

  public updateSession(id: string, updates: Partial<Omit<Session, 'id'>>): void {
    const existing = this.sessions.get(id);
    if (!existing) {
      throw new Error('Session not found');
    }
    const updated = { ...existing, ...updates } as Session;
    this.validateSession(updated);
    this.sessions.set(id, updated);
    this.updatedAt = new Date();
  }

  public removeSession(id: string): void {
    if (!this.sessions.has(id)) {
      throw new Error('Session not found');
    }
    this.sessions.delete(id);
    this.updatedAt = new Date();
  }

  public getTrainerSchedule(trainerId: TrainerId, week: ScheduleWeek): Session[] {
    return this.getSessionsForWeek(week).filter((s) => s.trainerId.equals(trainerId));
  }

  public isSlotAvailable(timeslot: TimeSlot, courtId?: string, excludeSessionId?: string): boolean {
    for (const session of this.sessions.values()) {
      if (excludeSessionId && session.id === excludeSessionId) continue;
      if (session.courtId === courtId && session.timeslot.overlaps(timeslot)) {
        return false;
      }
    }
    return true;
  }

  public getCreatedAt(): Date {
    return new Date(this.createdAt);
  }

  public getUpdatedAt(): Date {
    return new Date(this.updatedAt);
  }
}

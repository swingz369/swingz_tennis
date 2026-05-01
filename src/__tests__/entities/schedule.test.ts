import { describe, it, expect, beforeEach } from 'vitest';
import { Schedule, type Session, type TrainingGroup } from '@/domain/entities/schedule';
import { ClubId, TrainerId, MemberId } from '@/domain/value-objects';
import { TimeSlot, ScheduleWeek } from '@/domain/value-objects';

describe('Schedule', () => {
  const clubId = ClubId.create();
  const startDate = new Date(2024, 0, 1);
  const endDate = new Date(2024, 11, 31);

  describe('create', () => {
    it('should create a schedule with valid data', () => {
      const schedule = Schedule.create(clubId, 'spring', 2024, startDate, endDate);

      expect(schedule.getClubId().equals(clubId)).toBe(true);
      expect(schedule.getSeason().type).toBe('spring');
      expect(schedule.getSeason().year).toBe(2024);
      expect(schedule.getSessions()).toHaveLength(0);
    });

    it('should throw if start date is after end date', () => {
      expect(() => Schedule.create(clubId, 'spring', 2024, endDate, startDate)).toThrow(
        'Season start date must be before end date'
      );
    });
  });

  describe('session management', () => {
    let schedule: Schedule;
    let trainerId1: TrainerId;
    let trainerId2: TrainerId;

    const createSession = (id: string, trainerId: TrainerId, startHour: number): Session => ({
      id,
      trainerId,
      groupIds: ['group-1'],
      week: ScheduleWeek.fromDate(new Date(2024, 0, startHour)),
      timeslot: new TimeSlot(
        new Date(2024, 0, startHour, 10, 0),
        new Date(2024, 0, startHour, 11, 0)
      ),
      maxParticipants: 10,
    });

    beforeEach(() => {
      schedule = Schedule.create(clubId, 'spring', 2024, startDate, endDate);
      trainerId1 = TrainerId.fromString('trainer-1');
      trainerId2 = TrainerId.fromString('trainer-2');
    });

    it('should add sessions', () => {
      const session = createSession('s1', trainerId1, 1);
      schedule.addSession(session);

      expect(schedule.getSessions()).toHaveLength(1);
    });

    it('should throw on trainer double booking', () => {
      schedule.addSession(createSession('s1', trainerId1, 1));
      expect(() => schedule.addSession(createSession('s2', trainerId1, 1))).toThrow(
        'Trainer double booking conflict'
      );
    });

    it('should throw on court double booking when court is specified', () => {
      const session1 = createSession('s1', trainerId1, 1);
      session1.courtId = 'court-1';
      schedule.addSession(session1);

      const session2 = createSession('s2', trainerId2, 1);
      session2.courtId = 'court-1';
      expect(() => schedule.addSession(session2)).toThrow('Court double booking conflict');
    });

    it('should allow same trainer at different times', () => {
      schedule.addSession(createSession('s1', trainerId1, 1));
      schedule.addSession(createSession('s2', trainerId1, 2));

      expect(schedule.getSessions()).toHaveLength(2);
    });

    it('should remove sessions', () => {
      schedule.addSession(createSession('s1', trainerId1, 1));
      schedule.removeSession('s1');

      expect(schedule.getSessions()).toHaveLength(0);
    });

    it('should throw when removing non-existent session', () => {
      expect(() => schedule.removeSession('non-existent')).toThrow('Session not found');
    });
  });

  describe('training groups', () => {
    let schedule: Schedule;

    beforeEach(() => {
      schedule = Schedule.create(clubId, 'spring', 2024, startDate, endDate);
    });

    it('should add training groups', () => {
      const group: TrainingGroup = {
        id: 'group-1',
        name: 'Anfänger',
        memberIds: [MemberId.create(), MemberId.create()],
        level: 'beginner',
        ageGroup: 'junior',
        isActive: true,
      };

      schedule.addTrainingGroup(group);
      expect(schedule.getTrainingGroups()).toHaveLength(1);
    });

    it('should remove groups (soft delete)', () => {
      const group: TrainingGroup = {
        id: 'group-1',
        name: 'Anfänger',
        memberIds: [],
        level: 'beginner',
        ageGroup: 'junior',
        isActive: true,
      };

      schedule.addTrainingGroup(group);
      schedule.removeTrainingGroup('group-1');

      const groups = schedule.getTrainingGroups();
      expect(groups).toHaveLength(0);
    });
  });
});

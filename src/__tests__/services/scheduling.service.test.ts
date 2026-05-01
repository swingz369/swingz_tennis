import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SchedulingService } from '@/domain/services/scheduling.service';
import { Schedule, type Session } from '@/domain/entities/schedule';
import { ClubId, TrainerId } from '@/domain/value-objects';
import { TimeSlot, ScheduleWeek } from '@/domain/value-objects';
import type { TrainerRepository } from '@/domain/repositories';

describe('SchedulingService', () => {
  let mockTrainerRepo: TrainerRepository;
  let clubId: ClubId;

  const createSession = (id: string, trainerId: TrainerId, dayOfWeek: number): Session => ({
    id,
    trainerId,
    groupIds: ['group-1'],
    week: ScheduleWeek.fromDate(new Date(2024, 0, dayOfWeek)),
    timeslot: new TimeSlot(
      new Date(2024, 0, dayOfWeek, 10, 0),
      new Date(2024, 0, dayOfWeek, 11, 0)
    ),
    maxParticipants: 10,
  });

  const createScheduleWithSessions = (sessions: Session[]): Schedule => {
    const schedule = Schedule.create(
      clubId,
      'spring',
      2024,
      new Date(2024, 0, 1),
      new Date(2024, 11, 31)
    );
    for (const session of sessions) {
      try {
        schedule.addSession(session);
      } catch {
        // Ignore conflicts during setup
      }
    }
    return schedule;
  };

  beforeEach(() => {
    clubId = ClubId.create();
    mockTrainerRepo = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findByClub: vi.fn(),
      findBySpecialty: vi.fn(),
      save: vi.fn(),
      exists: vi.fn(),
    } as unknown as TrainerRepository;
  });

  it('should detect trainer double bookings in AI plan', async () => {
    const trainerId = TrainerId.fromString('trainer-1');
    const schedule = Schedule.create(
      clubId,
      'spring',
      2024,
      new Date(2024, 0, 1),
      new Date(2024, 11, 31)
    );

    const service = new SchedulingService(mockTrainerRepo);

    // AI plan generates two sessions for same trainer at same time
    const aiPlan = {
      groups: [
        {
          id: 'g1',
          day_of_week: 1,
          start_time: '10:00',
          trainer_id: trainerId.getValue(),
          member_ids: [],
          max_participants: 10,
        },
        {
          id: 'g2',
          day_of_week: 1,
          start_time: '10:00',
          trainer_id: trainerId.getValue(),
          member_ids: [],
          max_participants: 10,
        },
      ],
    };

    const result = await service.optimizeSchedule(schedule, aiPlan);

    expect(result.conflicts.length).toBeGreaterThanOrEqual(1);
    expect(result.conflicts.some((c) => c.type === 'trainer_double')).toBe(true);
  });

  it('should accept sessions without conflicts', async () => {
    const trainerId1 = TrainerId.fromString('trainer-1');
    const trainerId2 = TrainerId.fromString('trainer-2');

    const schedule = createScheduleWithSessions([
      createSession('s1', trainerId1, 1),
      createSession('s2', trainerId2, 2),
    ]);

    const service = new SchedulingService(mockTrainerRepo);
    const result = await service.optimizeSchedule(schedule, { groups: [] });

    expect(result.conflicts).toHaveLength(0);
    expect(result.schedule.getSessions()).toHaveLength(2);
  });
});

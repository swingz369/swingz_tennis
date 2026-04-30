import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetClubAnalyticsUseCase } from '@/application/analytics/club-analytics.use-cases';
import type { ClubRepository } from '@/domain/repositories';
import type { ScheduleRepository } from '@/domain/repositories';
import type { TrainerRepository } from '@/domain/repositories';
import type { CourtRepository } from '@/domain/repositories';
import type { BookingRepository } from '@/domain/repositories';
import { ClubId } from '@/domain/value-objects';
import type { Club } from '@/domain/entities/club';
import type { Session } from '@/domain/entities/schedule';
import type { Court } from '@/domain/entities/club';

const createClubId = (id: string) => ClubId.fromString(id);

function createMockClub(id = 'club-123'): Club {
  return {
    getId: () => createClubId(id),
    getName: () => 'Test Club',
    getMemberCount: () => 42,
    getMaxMembers: () => 100,
    getStatus: () => 'active' as const,
  } as unknown as Club;
}

function createMockCourt(id: string = 'court-1', name: string = 'Court 1'): Court {
  return {
    id,
    name,
    surface: 'clay' as const,
    hasIndoor: false,
    isActive: true,
  };
}

function createMockSession(
  id: string = 'sess-1',
  trainerId: string = 'trainer-1',
  courtId?: string,
  start: Date = new Date('2025-02-15T10:00:00'),
  durationMins: number = 60
): Session {
  // Minimal structural mock sufficient for use-case logic
  return {
    id,
    trainerId: { toString: () => trainerId } as any,
    groupIds: [],
    week: { toString: () => '2025-W01' } as any,
    timeslot: {
      getStart: () => start,
      getEnd: () => new Date(start.getTime() + durationMins * 60000),
      getDurationMinutes: () => durationMins,
      overlaps: () => false,
    } as any,
    courtId,
    maxParticipants: 4,
    notes: undefined,
  } as any;
}

const createMockClubRepo = () => ({
  findById: vi.fn(),
  getMemberStats: vi.fn(),
  getMemberGrowthHistory: vi.fn(),
});

const createMockScheduleRepo = () => ({
  findSessionsByClubId: vi.fn(),
});

const createMockTrainerRepo = () => ({
  findById: vi.fn(),
});

const createMockCourtRepo = () => ({
  findByClub: vi.fn(),
});

const createMockBookingRepo = () => ({
  countByClubAndDateRange: vi.fn(),
});

describe('GetClubAnalyticsUseCase', () => {
  let useCase: GetClubAnalyticsUseCase;
  let mockClubRepo: ReturnType<typeof createMockClubRepo>;
  let mockScheduleRepo: ReturnType<typeof createMockScheduleRepo>;
  let mockTrainerRepo: ReturnType<typeof createMockTrainerRepo>;
  let mockCourtRepo: ReturnType<typeof createMockCourtRepo>;
  let mockBookingRepo: ReturnType<typeof createMockBookingRepo>;

  const clubId = createClubId('club-123');
  const startDate = new Date('2025-01-01');
  const endDate = new Date('2025-06-30');

  beforeEach(() => {
    vi.clearAllMocks();
    mockClubRepo = createMockClubRepo();
    mockScheduleRepo = createMockScheduleRepo();
    mockTrainerRepo = createMockTrainerRepo();
    mockCourtRepo = createMockCourtRepo();
    mockBookingRepo = createMockBookingRepo();

    useCase = new GetClubAnalyticsUseCase(
      mockClubRepo as unknown as ClubRepository,
      mockScheduleRepo as unknown as ScheduleRepository,
      mockTrainerRepo as unknown as TrainerRepository,
      mockCourtRepo as unknown as CourtRepository,
      mockBookingRepo as unknown as BookingRepository
    );
  });

  it('should throw error if club not found', async () => {
    mockClubRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(clubId.getValue(), startDate, endDate)).rejects.toThrow(
      'Club not found'
    );
  });

  it('should calculate metrics with sessions and trainers', async () => {
    const mockClub = createMockClub();
    mockClubRepo.findById.mockResolvedValue(mockClub);

    const courts = [createMockCourt('c1', 'Platz 1'), createMockCourt('c2', 'Platz 2')];
    mockCourtRepo.findByClub.mockResolvedValue(courts);

    const sessions: Session[] = [
      createMockSession('s1', 't1', 'c1', new Date('2025-02-01T10:00:00'), 60),
      createMockSession('s2', 't1', 'c2', new Date('2025-02-08T10:00:00'), 60),
      createMockSession('s3', 't2', 'c1', new Date('2025-02-15T10:00:00'), 90),
    ];
    mockScheduleRepo.findSessionsByClubId.mockResolvedValue(sessions);

    const trainer1 = { name: 'Max Mustermann', trainerId: { toString: () => 't1' } as any };
    const trainer2 = { name: 'Anna Schmidt', trainerId: { toString: () => 't2' } as any };
    mockTrainerRepo.findById.mockResolvedValueOnce(trainer1).mockResolvedValueOnce(trainer2);

    mockBookingRepo.countByClubAndDateRange.mockResolvedValue({
      total: 10,
      confirmed: 8,
      cancelled: 1,
      noShow: 1,
    });

    mockClubRepo.getMemberStats.mockResolvedValue({
      total: 50,
      new: 5,
      active: 42,
    });

    mockClubRepo.getMemberGrowthHistory.mockResolvedValue([
      { month: '2025-01', count: 35 },
      { month: '2025-02', count: 38 },
      { month: '2025-03', count: 40 },
      { month: '2025-04', count: 42 },
      { month: '2025-05', count: 44 },
      { month: '2025-06', count: 46 },
    ]);

    const result = await useCase.execute(clubId.getValue(), startDate, endDate);

    expect(result.metrics.totalMembers).toBe(42);
    expect(result.metrics.totalSessions).toBe(3);
    expect(result.metrics.totalTrainingHours).toBeCloseTo(3.5, 1); // (60+60+90)/60 = 2.5
    expect(result.sessionsPerTrainer).toHaveLength(2);
    expect(
      result.sessionsPerTrainer.find((t) => t.trainerName === 'Max Mustermann')?.sessions
    ).toBe(2);
    expect(result.sessionsPerTrainer.find((t) => t.trainerName === 'Anna Schmidt')?.sessions).toBe(
      1
    );
    expect(result.capacityUtilization).toHaveLength(2);
    expect(result.capacityUtilization.map((c) => c.courtName)).toContain('Platz 1');
    expect(result.capacityUtilization.map((c) => c.courtName)).toContain('Platz 2');
  });

  it('should handle empty datasets', async () => {
    const mockClub = createMockClub();
    mockClubRepo.findById.mockResolvedValue(mockClub);
    mockCourtRepo.findByClub.mockResolvedValue([]);
    mockScheduleRepo.findSessionsByClubId.mockResolvedValue([]);

    mockBookingRepo.countByClubAndDateRange.mockResolvedValue({
      total: 0,
      confirmed: 0,
      cancelled: 0,
      noShow: 0,
    });

    mockClubRepo.getMemberStats.mockResolvedValue({
      total: 0,
      new: 0,
      active: 0,
    });

    mockClubRepo.getMemberGrowthHistory.mockResolvedValue([]);

    const result = await useCase.execute(clubId.getValue(), startDate, endDate);

    expect(result.metrics.totalSessions).toBe(0);
    expect(result.metrics.totalTrainingHours).toBe(0);
    expect(result.sessionsPerTrainer).toEqual([]);
    expect(result.capacityUtilization).toEqual([]);
  });

  it('should filter sessions by date range', async () => {
    const mockClub = createMockClub();
    mockClubRepo.findById.mockResolvedValue(mockClub);
    mockCourtRepo.findByClub.mockResolvedValue([]);

    const outsideSession = createMockSession(
      's-out',
      't1',
      undefined,
      new Date('2024-12-01T10:00:00'),
      60
    );
    const insideSession = createMockSession(
      's-in',
      't1',
      undefined,
      new Date('2025-03-01T10:00:00'),
      60
    );
    const allSessions = [outsideSession, insideSession];
    mockScheduleRepo.findSessionsByClubId.mockResolvedValue(allSessions);
    mockTrainerRepo.findById.mockResolvedValue({
      name: 'Trainer One',
      trainerId: { toString: () => 't1' } as any,
    });

    mockBookingRepo.countByClubAndDateRange.mockResolvedValue({
      total: 1,
      confirmed: 1,
      cancelled: 0,
      noShow: 0,
    });

    mockClubRepo.getMemberStats.mockResolvedValue({
      total: 10,
      new: 2,
      active: 8,
    });

    mockClubRepo.getMemberGrowthHistory.mockResolvedValue([
      { month: '2025-01', count: 5 },
      { month: '2025-02', count: 6 },
      { month: '2025-03', count: 7 },
      { month: '2025-04', count: 8 },
      { month: '2025-05', count: 9 },
      { month: '2025-06', count: 10 },
    ]);

    const result = await useCase.execute(clubId.getValue(), startDate, endDate);

    expect(result.metrics.totalSessions).toBe(1);
    expect(result.sessionsPerTrainer[0].sessions).toBe(1);
  });

  it('should calculate court utilization percentage', async () => {
    const mockClub = createMockClub();
    mockClubRepo.findById.mockResolvedValue(mockClub);
    mockCourtRepo.findByClub.mockResolvedValue([createMockCourt('c1', 'Center Court')]);

    // 2-hour session on one court over ~6 months ~ 180 days -> ~2/ (10*180) = 0.1%
    const session = createMockSession('s1', 't1', 'c1', new Date('2025-03-01T10:00:00'), 120);
    mockScheduleRepo.findSessionsByClubId.mockResolvedValue([session]);

    mockTrainerRepo.findById.mockResolvedValue({
      name: 'Trainer One',
      trainerId: { toString: () => 't1' } as any,
    });

    mockBookingRepo.countByClubAndDateRange.mockResolvedValue({
      total: 1,
      confirmed: 1,
      cancelled: 0,
      noShow: 0,
    });

    mockClubRepo.getMemberStats.mockResolvedValue({
      total: 5,
      new: 1,
      active: 4,
    });

    mockClubRepo.getMemberGrowthHistory.mockResolvedValue([
      { month: '2025-01', count: 2 },
      { month: '2025-02', count: 3 },
      { month: '2025-03', count: 4 },
      { month: '2025-04', count: 5 },
      { month: '2025-05', count: 5 },
      { month: '2025-06', count: 5 },
    ]);

    const result = await useCase.execute(clubId.getValue(), startDate, endDate);

    expect(result.capacityUtilization).toHaveLength(1);
    expect(result.capacityUtilization[0].courtName).toBe('Center Court');
    // util is small (2 hours / (10 hrs/day * ~181 days))
    expect(result.capacityUtilization[0].util).toBeGreaterThanOrEqual(0);
    expect(result.capacityUtilization[0].util).toBeLessThanOrEqual(100);
  });
});

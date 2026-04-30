import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OptimizeScheduleUseCase } from '@/application/use-cases/schedule.use-cases';
import type { SchedulingService } from '@/domain/services/scheduling.service';
import type { ScheduleRepository } from '@/domain/repositories';
import { ClubId } from '@/domain/value-objects';
import type { Schedule } from '@/domain/entities/schedule';
import type { ScheduleOptimizationResult } from '@/domain/services/scheduling.service';

// Mock Dependencies
vi.mock('@/infrastructure/ai/ai-client', () => ({
  AIClient: class {
    generateSchedule() {
      return Promise.resolve({ groups: [] });
    }
  },
}));

vi.mock('@/infrastructure/persistence/repositories/trainer.repository', () => ({
  DrizzleTrainerRepository: class {
    findByClub() {
      return Promise.resolve([]);
    }
  },
}));

vi.mock('@/infrastructure/persistence/repositories/court.repository', () => ({
  DrizzleCourtRepository: class {
    findByClub() {
      return Promise.resolve([]);
    }
  },
}));

const createMockScheduleRepo = () => ({
  findByClubId: vi.fn(),
  save: vi.fn(),
});

const createMockSchedulingService = () => ({
  optimizeSchedule: vi.fn(),
});

function createMockSchedule(): Schedule {
  const start = new Date('2025-01-01');
  const end = new Date('2025-12-31');
  return {
    getId: () => ClubId.fromString('sch-123'),
    getClubId: () => ClubId.fromString('club-123'),
    getSeason: () => ({ type: 'summer' as const, year: 2025, startDate: start, endDate: end }),
    getTrainingGroups: () => [],
    getSessions: () => [],
    getCreatedAt: () => new Date(),
    getUpdatedAt: () => new Date(),
  } as unknown as Schedule;
}

describe('OptimizeScheduleUseCase', () => {
  let useCase: OptimizeScheduleUseCase;
  let mockScheduleRepo: ReturnType<typeof createMockScheduleRepo>;
  let mockSchedulingService: ReturnType<typeof createMockSchedulingService>;

  const clubId = ClubId.fromString('club-123');

  beforeEach(() => {
    vi.clearAllMocks();
    mockScheduleRepo = createMockScheduleRepo();
    mockSchedulingService = createMockSchedulingService();
    useCase = new OptimizeScheduleUseCase(
      mockScheduleRepo as unknown as ScheduleRepository,
      mockSchedulingService as unknown as SchedulingService
    );
  });

  it('should fetch and optimize existing schedule', async () => {
    const mockSchedule = createMockSchedule();
    mockScheduleRepo.findByClubId.mockResolvedValue(mockSchedule);
    const mockResult: ScheduleOptimizationResult = {
      schedule: mockSchedule,
      conflicts: [],
      adjustmentsMade: [],
      fitnessScore: 85,
    };
    mockSchedulingService.optimizeSchedule.mockResolvedValue(mockResult);

    const result = await useCase.execute({
      clubId: clubId.getValue(),
      seasonType: 'summer',
      year: 2025,
    });

    expect(mockScheduleRepo.findByClubId).toHaveBeenCalledWith(clubId);
    expect(mockSchedulingService.optimizeSchedule).toHaveBeenCalledTimes(1);
    expect(mockScheduleRepo.save).toHaveBeenCalledWith(mockSchedule);
    expect(result.fitnessScore).toBe(85);
  });

  it('should use AI generation when forceRegenerate is true', async () => {
    const mockSchedule = createMockSchedule();
    mockScheduleRepo.findByClubId.mockResolvedValue(mockSchedule);
    const mockResult: ScheduleOptimizationResult = {
      schedule: mockSchedule,
      conflicts: [],
      adjustmentsMade: [],
      fitnessScore: 95,
    };
    mockSchedulingService.optimizeSchedule.mockResolvedValue(mockResult);

    const generateAIPlanSpy = vi.spyOn(useCase as any, 'generateAIPlan');
    generateAIPlanSpy.mockResolvedValue({ groups: [] });

    const result = await useCase.execute({
      clubId: clubId.getValue(),
      seasonType: 'summer',
      year: 2025,
      forceRegenerate: true,
    });

    expect(generateAIPlanSpy).toHaveBeenCalledWith(mockSchedule);
    expect(mockSchedulingService.optimizeSchedule).toHaveBeenCalledTimes(1);
    expect(result.fitnessScore).toBe(95);
  });

  it('should propagate save errors', async () => {
    const mockSchedule = createMockSchedule();
    mockScheduleRepo.findByClubId.mockResolvedValue(mockSchedule);
    mockSchedulingService.optimizeSchedule.mockResolvedValue({
      schedule: mockSchedule,
      conflicts: [],
      adjustmentsMade: [],
      fitnessScore: 80,
    });
    mockScheduleRepo.save.mockRejectedValue(new Error('Database error'));

    await expect(
      useCase.execute({
        clubId: clubId.getValue(),
        seasonType: 'summer',
        year: 2025,
      })
    ).rejects.toThrow('Database error');
  });

  it('should skip AI when forceRegenerate is false', async () => {
    const mockSchedule = createMockSchedule();
    mockScheduleRepo.findByClubId.mockResolvedValue(mockSchedule);
    mockSchedulingService.optimizeSchedule.mockResolvedValue({
      schedule: mockSchedule,
      conflicts: [],
      adjustmentsMade: [],
      fitnessScore: 70,
    });

    const generateAIPlanSpy = vi.spyOn(useCase as any, 'generateAIPlan');

    await useCase.execute({
      clubId: clubId.getValue(),
      seasonType: 'summer',
      year: 2025,
      forceRegenerate: false,
    });

    expect(generateAIPlanSpy).not.toHaveBeenCalled();
  });

  it('should return proper output shape', async () => {
    const mockSchedule = createMockSchedule();
    mockScheduleRepo.findByClubId.mockResolvedValue(mockSchedule);
    mockSchedulingService.optimizeSchedule.mockResolvedValue({
      schedule: mockSchedule,
      conflicts: [
        { type: 'trainer_double', severity: 'high', description: 'Conflict', affectedSessions: [] },
      ],
      adjustmentsMade: [{ sessionId: 's1', change: 'rescheduled' as const, reason: 'Overlap' }],
      fitnessScore: 88,
    });

    const result = await useCase.execute({
      clubId: clubId.getValue(),
      seasonType: 'summer',
      year: 2025,
    });

    expect(result).toHaveProperty('schedule');
    expect(result).toHaveProperty('conflicts');
    expect(result).toHaveProperty('adjustmentsMade');
    expect(result).toHaveProperty('fitnessScore');
    expect(result.fitnessScore).toBe(88);
    expect(result.conflicts).toHaveLength(1);
    expect(result.adjustmentsMade[0].change).toBe('rescheduled');
  });
});

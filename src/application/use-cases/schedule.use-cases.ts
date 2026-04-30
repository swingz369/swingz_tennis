import {
  SchedulingService,
  type AIGeneratedPlan,
  type ScheduleOptimizationResult,
} from '@/domain/services/scheduling.service';
import { ScheduleRepository } from '@/domain/repositories';
import { Schedule as ScheduleEntity } from '@/domain/entities/schedule';
import { ClubId } from '@/domain/value-objects';
import type { Court } from '@/domain/entities/club';
import { DrizzleCourtRepository } from '@/infrastructure/persistence/repositories/court.repository';

export interface OptimizeScheduleInput {
  clubId: string;
  seasonType: ScheduleEntity['season']['type'];
  year: number;
  forceRegenerate?: boolean;
}

export interface OptimizeScheduleOutput {
  schedule: ScheduleEntity;
  conflicts: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
  adjustmentsMade: Array<{
    sessionId: string;
    change: string;
    reason: string;
  }>;
  fitnessScore: number;
}

export class OptimizeScheduleUseCase {
  constructor(
    private scheduleRepository: ScheduleRepository,
    private schedulingService: SchedulingService
  ) {}

  async execute(input: OptimizeScheduleInput): Promise<OptimizeScheduleOutput> {
    let schedule = await this.scheduleRepository.findByClubId(ClubId.fromString(input.clubId));

    if (!schedule) {
      schedule = ScheduleEntity.create(
        ClubId.fromString(input.clubId),
        input.seasonType,
        input.year,
        new Date(),
        new Date()
      );
    }

    if (!input.forceRegenerate) {
      const result = await this.schedulingService.optimizeSchedule(schedule, { groups: [] });
      await this.scheduleRepository.save(result.schedule);
      return this.mapOutput(result);
    }

    const aiPlan = await this.generateAIPlan(schedule);
    const result = await this.schedulingService.optimizeSchedule(schedule, aiPlan);
    await this.scheduleRepository.save(result.schedule);
    return this.mapOutput(result);
  }

  private async generateAIPlan(schedule: ScheduleEntity): Promise<AIGeneratedPlan> {
    const { AIClient } = await import('@/infrastructure/ai/ai-client');
    const aiClient = new AIClient();

    const { DrizzleTrainerRepository } =
      await import('@/infrastructure/persistence/repositories/trainer.repository');
    const trainerRepo = new DrizzleTrainerRepository();
    const trainers = await trainerRepo.findByClub(schedule.getClubId());

    const { DrizzleCourtRepository } =
      await import('@/infrastructure/persistence/repositories/court.repository');
    const courtRepo: DrizzleCourtRepository = new DrizzleCourtRepository();
    const courts: Court[] = await courtRepo.findByClub(schedule.getClubId());

    const groups = schedule.getTrainingGroups().map((g) => ({
      id: g.id,
      name: g.name,
      level: g.level as string,
      ageGroup: g.ageGroup as string,
      memberCount: g.memberIds.length,
    }));

    const request = {
      clubId: schedule.getClubId().getValue(),
      season: {
        type: schedule.getSeason().type,
        year: schedule.getSeason().year,
      },
      trainers: trainers.map((t) => ({
        id: t.trainerId.getValue(),
        name: t.name,
        specialties: t.specialties,
        maxHoursPerWeek: t.maxHoursPerWeek,
      })),
      groups,
      courts: courts.map((c) => ({
        id: c.id,
        name: c.name,
        surface: c.surface,
        hasIndoor: c.hasIndoor,
      })),
      constraints: {
        maxTrainerHours: 40,
        noDoubleBooking: true,
        groupSizeLimits: {},
      },
    };

    return aiClient.generateSchedule(request);
  }

  private mapOutput(result: ScheduleOptimizationResult): OptimizeScheduleOutput {
    return {
      schedule: result.schedule,
      conflicts: result.conflicts.map((c) => ({
        type: c.type,
        severity: c.severity,
        description: c.description,
      })),
      adjustmentsMade: result.adjustmentsMade.map((a) => ({
        sessionId: a.sessionId,
        change: a.change,
        reason: a.reason,
      })),
      fitnessScore: result.fitnessScore,
    };
  }
}

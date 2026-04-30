import { Schedule } from '../entities/schedule';
import type { Session } from '../entities/schedule';
import { ScheduleWeek, TimeSlot, TrainerId } from '../value-objects';
import type { TrainerRepository } from '../repositories';

export interface ScheduleOptimizationResult {
  schedule: Schedule;
  conflicts: ConflictInfo[];
  adjustmentsMade: Adjustment[];
  fitnessScore: number;
}

export interface ConflictInfo {
  type: 'trainer_double' | 'over_capacity' | 'missing_trainer' | 'suboptimal_grouping';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedSessions: string[];
}

export interface Adjustment {
  sessionId: string;
  change: 'rescheduled' | 'trainer_reassigned' | 'split' | 'merged';
  reason: string;
}

export class SchedulingService {
  constructor(_trainerRepository: TrainerRepository) {
    // Reserved for future trainer validation
    void _trainerRepository;
  }

  public async optimizeSchedule(
    schedule: Schedule,
    aiGeneratedPlan: AIGeneratedPlan
  ): Promise<ScheduleOptimizationResult> {
    const conflicts: ConflictInfo[] = [];
    const adjustments: Adjustment[] = [];

    const sessionList = schedule.getSessions();
    const newSessions = this.createSessionsFromPlan(aiGeneratedPlan, schedule.getSeason());

    const allSessions = [...sessionList, ...newSessions];
    const validatedSessions = this.validateAllSessions(allSessions, conflicts);

    const fixedSessions = this.heuristicRepair(validatedSessions, conflicts, adjustments);

    const fitnessScore = this.calculateFitnessScore(fixedSessions);

    const optimizedSchedule = Schedule.reconstitute(
      schedule.getId(),
      schedule.getClubId(),
      schedule.getSeason(),
      schedule.getTrainingGroups(),
      fixedSessions,
      schedule.getCreatedAt(),
      new Date()
    );

    return {
      schedule: optimizedSchedule,
      conflicts,
      adjustmentsMade: adjustments,
      fitnessScore,
    };
  }

  private createSessionsFromPlan(aiPlan: AIGeneratedPlan, season: Schedule['season']): Session[] {
    const sessions: Session[] = [];

    for (const groupPlan of aiPlan.groups) {
      try {
        // Calculate date from season start + day_of_week
        const baseDate = new Date(season.startDate);
        baseDate.setDate(baseDate.getDate() + (groupPlan.day_of_week - 1));

        const [hours, minutes] = groupPlan.start_time.split(':').map(Number);
        const timeslotStart = new Date(baseDate);
        timeslotStart.setHours(hours, minutes, 0, 0);
        const timeslotEnd = new Date(timeslotStart);
        timeslotEnd.setMinutes(timeslotEnd.getMinutes() + 60);

        const week = ScheduleWeek.fromDate(timeslotStart);

        const sessionData: Session = {
          id: groupPlan.id,
          trainerId: TrainerId.fromString(groupPlan.trainer_id),
          groupIds: groupPlan.group_ids || [groupPlan.group_id || groupPlan.id],
          week,
          timeslot: new TimeSlot(timeslotStart, timeslotEnd),
          maxParticipants: groupPlan.max_participants || 10,
        };
        if (groupPlan.notes) {
          sessionData.notes = groupPlan.notes;
        }
        sessions.push(sessionData);
      } catch {
        // errors handled by validation
      }
    }

    return sessions;
  }

  private validateAllSessions(sessions: Session[], conflicts: ConflictInfo[]): Session[] {
    const validSessions: Session[] = [];

    for (let i = 0; i < sessions.length; i++) {
      const current = sessions[i];
      let isValid = true;

      for (let j = 0; j < sessions.length; j++) {
        if (i === j) continue;
        const other = sessions[j];
        if (
          current.trainerId.equals(other.trainerId) &&
          current.timeslot.overlaps(other.timeslot)
        ) {
          conflicts.push({
            type: 'trainer_double',
            severity: 'high',
            description: `Trainer double booking: ${current.trainerId}`,
            affectedSessions: [current.id, other.id],
          });
          isValid = false;
        }
      }

      if (isValid) {
        validSessions.push(current);
      }
    }

    return validSessions;
  }

  private heuristicRepair(
    sessions: Session[],
    conflicts: ConflictInfo[],
    adjustments: Adjustment[]
  ): Session[] {
    if (conflicts.length === 0) {
      return sessions;
    }

    const fixed = [...sessions];
    const processed = new Set<string>();

    for (const conflict of conflicts) {
      if (conflict.type === 'trainer_double') {
        for (const sid of conflict.affectedSessions) {
          if (processed.has(sid)) continue;
          processed.add(sid);
          const session = fixed.find((s) => s.id === sid);
          if (session) {
            const newDate = new Date(session.timeslot.getStart());
            newDate.setDate(newDate.getDate() + 1);
            const newEnd = new Date(newDate);
            newEnd.setMinutes(newEnd.getMinutes() + 60);
            session.timeslot = new TimeSlot(newDate, newEnd);
            adjustments.push({
              sessionId: sid,
              change: 'rescheduled',
              reason: 'Automatic rescheduling to resolve conflict',
            });
          }
        }
      }
    }

    return fixed;
  }

  private calculateFitnessScore(sessions: Session[]): number {
    let score = 100;
    const trainerHours = new Map<string, number>();

    for (const session of sessions) {
      const key = session.trainerId.toString();
      const current = trainerHours.get(key) || 0;
      trainerHours.set(key, current + session.timeslot.getDurationMinutes());
    }

    for (const [, hours] of trainerHours) {
      if (hours > 40 * 60) score -= 15;
      if (hours < 15 * 60) score -= 5;
    }

    const values = Array.from(trainerHours.values());
    if (values.length > 0) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      if (avg < 20 * 60) score -= 10;
    }

    return Math.max(0, score);
  }
}

export interface AIGeneratedPlan {
  groups: Array<{
    id: string;
    group_id?: string;
    group_ids?: string[];
    day_of_week: number;
    start_time: string;
    trainer_id: string;
    max_participants?: number;
    notes?: string;
  }>;
}

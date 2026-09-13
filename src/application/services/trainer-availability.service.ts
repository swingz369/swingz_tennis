import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import { getUserDb } from '@/infrastructure/db';
import type { TablesUpdate } from '@/types/supabase';
import {
  TrainerAvailabilityRepository,
  type TrainerAvailability,
  type AvailabilityQuery,
  type AvailabilityStatus,
} from '@/infrastructure/persistence/repositories/trainer-availability.repository';

export type CreateTrainerAvailabilityInput = {
  trainerId: string;
  date: string;
  startTime: string;
  endTime: string;
  status?: 'available' | 'unavailable' | 'blocked';
  notes?: string;
  recurringPattern?: {
    type: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate?: string;
  };
};

export type UpdateTrainerAvailabilityInput = Partial<{
  date: string;
  startTime: string;
  endTime: string;
  status: AvailabilityStatus;
  notes: string;
}>;

export type AvailabilityConflict = {
  trainerId: string;
  date: string;
  startTime: string;
  endTime: string;
  conflictingWith: [string, string];
};

function hasTimeOverlap(a: TrainerAvailability, startTime: string, endTime: string): boolean {
  return (
    (startTime >= a.start_time && startTime < a.end_time) ||
    (endTime > a.start_time && endTime <= a.end_time) ||
    (startTime <= a.start_time && endTime >= a.end_time)
  );
}

/**
 * Trainer-Teildomäne "Verfügbarkeit" für ADR-005. Ein Service, ein
 * Repository, kein Adapter, keine Interfaces, keine In-Memory-Stub-
 * Implementierung. `recurringPattern` wird als Metadaten-Feld gespeichert,
 * nicht in Einzeltermine expandiert — das entspricht dem bisherigen
 * DB-Verhalten (die alte In-Memory-Expansion lief nie gegen die DB).
 */
export class TrainerAvailabilityService {
  private readonly repo: TrainerAvailabilityRepository;

  constructor(auth: AuthContext) {
    this.repo = new TrainerAvailabilityRepository(getUserDb(auth));
  }

  async createTrainerAvailability(
    input: CreateTrainerAvailabilityInput
  ): Promise<TrainerAvailability> {
    return this.repo.create({
      trainer_id: input.trainerId,
      date: input.date,
      start_time: input.startTime,
      end_time: input.endTime,
      status: input.status ?? 'available',
      notes: input.notes ?? null,
      recurring_pattern: input.recurringPattern ?? null,
    });
  }

  async getTrainerAvailabilityById(id: string): Promise<TrainerAvailability> {
    const availability = await this.repo.findById(id);
    if (!availability) throw new ApiException('NOT_FOUND', 'Trainer-Verfügbarkeit nicht gefunden');
    return availability;
  }

  async queryTrainerAvailabilities(query: AvailabilityQuery): Promise<TrainerAvailability[]> {
    return this.repo.findByQuery(query);
  }

  async updateTrainerAvailability(
    id: string,
    input: UpdateTrainerAvailabilityInput
  ): Promise<TrainerAvailability> {
    const update: TablesUpdate<'trainer_availabilities'> = {
      ...(input.date !== undefined && { date: input.date }),
      ...(input.startTime !== undefined && { start_time: input.startTime }),
      ...(input.endTime !== undefined && { end_time: input.endTime }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.notes !== undefined && { notes: input.notes }),
    };
    const updated = await this.repo.update(id, update);
    if (!updated) throw new ApiException('NOT_FOUND', 'Trainer-Verfügbarkeit nicht gefunden');
    return updated;
  }

  async deleteTrainerAvailability(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  /** Findet sich überschneidende Verfügbarkeitszeiträume im Datumsbereich. */
  async getAvailabilityConflicts(
    startDate: string,
    endDate: string
  ): Promise<AvailabilityConflict[]> {
    const availabilities = await this.repo.findByDateRange(undefined, startDate, endDate);

    const grouped = new Map<string, TrainerAvailability[]>();
    for (const a of availabilities) {
      const key = `${a.trainer_id}::${a.date}`;
      const group = grouped.get(key) ?? [];
      group.push(a);
      grouped.set(key, group);
    }

    const conflicts: AvailabilityConflict[] = [];
    for (const group of grouped.values()) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          if (hasTimeOverlap(group[i], group[j].start_time, group[j].end_time)) {
            conflicts.push({
              trainerId: group[i].trainer_id,
              date: group[i].date,
              startTime: group[i].start_time,
              endTime: group[i].end_time,
              conflictingWith: [group[i].id, group[j].id],
            });
          }
        }
      }
    }
    return conflicts;
  }
}

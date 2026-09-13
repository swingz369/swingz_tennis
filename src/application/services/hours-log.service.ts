import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import { getUserDb } from '@/infrastructure/db';
import type { TablesUpdate } from '@/types/supabase';
import {
  HoursLogRepository,
  type HoursLog,
  type HoursLogType,
  type HoursLogStatus,
  type HoursSummary,
} from '@/infrastructure/persistence/repositories/hours-log.repository';

export type CreateHoursLogInput = {
  trainerId: string;
  trainerName: string;
  sessionId?: string;
  date: string;
  startTime: string;
  endTime: string;
  type: HoursLogType;
  notes?: string;
};

export type UpdateHoursLogInput = Partial<{
  startTime: string;
  endTime: string;
  type: HoursLogType;
  status: HoursLogStatus;
  notes: string;
}>;

/**
 * Trainer-Teildomäne "Stundenerfassung" für ADR-005. Ein Service, ein
 * Repository, kein Adapter, keine Interfaces.
 */
export class HoursLogService {
  private readonly repo: HoursLogRepository;

  constructor(auth: AuthContext) {
    this.repo = new HoursLogRepository(getUserDb(auth));
  }

  async createHoursLog(input: CreateHoursLogInput): Promise<HoursLog> {
    return this.repo.create({
      trainer_id: input.trainerId,
      trainer_name: input.trainerName,
      session_id: input.sessionId ?? null,
      date: input.date,
      start_time: input.startTime,
      end_time: input.endTime,
      type: input.type,
      notes: input.notes ?? null,
    });
  }

  async getHoursLogById(id: string): Promise<HoursLog> {
    const log = await this.repo.findById(id);
    if (!log) throw new ApiException('NOT_FOUND', 'Stundennachweis nicht gefunden');
    return log;
  }

  async findHoursLogById(id: string): Promise<HoursLog | null> {
    return this.repo.findById(id);
  }

  async updateHoursLog(id: string, input: UpdateHoursLogInput): Promise<HoursLog> {
    const update: TablesUpdate<'hours_logs'> = {
      ...(input.startTime !== undefined && { start_time: input.startTime }),
      ...(input.endTime !== undefined && { end_time: input.endTime }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.notes !== undefined && { notes: input.notes }),
    };
    const updated = await this.repo.update(id, update);
    if (!updated) throw new ApiException('NOT_FOUND', 'Stundennachweis nicht gefunden');
    return updated;
  }

  async approveHoursLog(id: string, approvedBy: string): Promise<HoursLog> {
    const updated = await this.repo.update(id, {
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    });
    if (!updated) throw new ApiException('NOT_FOUND', 'Stundennachweis nicht gefunden');
    return updated;
  }

  async rejectHoursLog(id: string, approvedBy: string, reason?: string): Promise<HoursLog> {
    const updated = await this.repo.update(id, {
      status: 'rejected',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      ...(reason !== undefined && { rejection_reason: reason }),
    });
    if (!updated) throw new ApiException('NOT_FOUND', 'Stundennachweis nicht gefunden');
    return updated;
  }

  async deleteHoursLog(id: string): Promise<void> {
    const deleted = await this.repo.delete(id);
    if (!deleted) throw new ApiException('NOT_FOUND', 'Stundennachweis nicht gefunden');
  }

  async getSummaryForTrainer(trainerId: string): Promise<HoursSummary> {
    return this.repo.getSummaryForTrainer(trainerId);
  }
}

import type { AuthContext } from '@/lib/api-auth';
import { ApiException } from '@/lib/api-error';
import { getUserDb } from '@/infrastructure/db';
import type { TablesUpdate } from '@/types/supabase';
import {
  AttendanceRecordRepository,
  type AttendanceRecord,
  type AttendanceHoursSummary,
} from '@/infrastructure/persistence/repositories/attendance-record.repository';

export type CreateAttendanceRecordInput = {
  sessionId: string;
  trainerId: string;
  trainerName: string;
  participantId: string;
  participantName: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  checkInTime?: string;
  checkOutTime?: string;
  notes?: string;
};

export type UpdateAttendanceRecordInput = Partial<{
  status: 'present' | 'absent' | 'late' | 'excused';
  checkInTime: string;
  checkOutTime: string;
  notes: string;
}>;

/**
 * Trainer-Teildomäne "Anwesenheit" für ADR-005. Ein Service, ein
 * Repository, kein Adapter, keine Interfaces.
 */
export class AttendanceRecordService {
  private readonly repo: AttendanceRecordRepository;

  constructor(auth: AuthContext) {
    this.repo = new AttendanceRecordRepository(getUserDb(auth));
  }

  async createAttendanceRecord(input: CreateAttendanceRecordInput): Promise<AttendanceRecord> {
    return this.repo.create({
      session_id: input.sessionId,
      trainer_id: input.trainerId,
      trainer_name: input.trainerName,
      participant_id: input.participantId,
      participant_name: input.participantName,
      date: input.date,
      status: input.status,
      check_in_time: input.checkInTime ?? null,
      check_out_time: input.checkOutTime ?? null,
      notes: input.notes ?? null,
    });
  }

  async getAttendanceRecordById(id: string): Promise<AttendanceRecord> {
    const record = await this.repo.findById(id);
    if (!record) throw new ApiException('NOT_FOUND', 'Anwesenheitseintrag nicht gefunden');
    return record;
  }

  async getAttendanceRecordsBySessionId(sessionId: string): Promise<AttendanceRecord[]> {
    return this.repo.findBySessionId(sessionId);
  }

  async getAttendanceRecordsByTrainerId(trainerId: string): Promise<AttendanceRecord[]> {
    return this.repo.findByTrainerId(trainerId);
  }

  async updateAttendanceRecord(
    id: string,
    input: UpdateAttendanceRecordInput
  ): Promise<AttendanceRecord> {
    const update: TablesUpdate<'attendance_records'> = {
      ...(input.status !== undefined && { status: input.status }),
      ...(input.checkInTime !== undefined && { check_in_time: input.checkInTime }),
      ...(input.checkOutTime !== undefined && { check_out_time: input.checkOutTime }),
      ...(input.notes !== undefined && { notes: input.notes }),
    };
    const updated = await this.repo.update(id, update);
    if (!updated) throw new ApiException('NOT_FOUND', 'Anwesenheitseintrag nicht gefunden');
    return updated;
  }

  async deleteAttendanceRecord(id: string): Promise<void> {
    const deleted = await this.repo.delete(id);
    if (!deleted) throw new ApiException('NOT_FOUND', 'Anwesenheitseintrag nicht gefunden');
  }

  async batchConfirmAttendance(ids: string[]): Promise<number> {
    return this.repo.batchConfirmByTrainer(ids);
  }

  async memberConfirmAttendance(id: string, participantId: string): Promise<AttendanceRecord> {
    const updated = await this.repo.memberConfirm(id, participantId);
    if (!updated) {
      throw new ApiException('NOT_FOUND', 'Eintrag nicht gefunden oder nicht berechtigt');
    }
    return updated;
  }

  async memberDisputeAttendance(
    id: string,
    participantId: string,
    reason: string
  ): Promise<AttendanceRecord> {
    const updated = await this.repo.memberDispute(id, participantId, reason);
    if (!updated) {
      throw new ApiException('NOT_FOUND', 'Eintrag nicht gefunden oder nicht berechtigt');
    }
    return updated;
  }

  async resolveAttendanceDispute(
    id: string,
    resolvedBy: string,
    resolution: 'confirmed' | 'absent'
  ): Promise<AttendanceRecord> {
    const updated = await this.repo.resolveDispute(id, resolvedBy, resolution);
    if (!updated) throw new ApiException('NOT_FOUND', 'Eintrag nicht gefunden');
    return updated;
  }

  async getAttendanceHoursSummaryForMember(
    memberId: string
  ): Promise<AttendanceHoursSummary | null> {
    return this.repo.getHoursSummaryForMember(memberId);
  }

  async getAttendanceHoursSummaryForClub(clubId: string): Promise<AttendanceHoursSummary[]> {
    return this.repo.getHoursSummaryForClub(clubId);
  }
}

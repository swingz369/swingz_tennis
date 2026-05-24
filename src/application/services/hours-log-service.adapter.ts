/**
 * Hours Log Service Adapter
 *
 * Drizzle-based hours log and attendance operations.
 *
 * Usage:
 * ```typescript
 * import { hoursLogService } from '@/application/services/hours-log-service.adapter';
 *
 * const logs = await hoursLogService.getAllHoursLogs();
 * ```
 */

import type {
  HoursLog,
  AttendanceRecord,
  CreateHoursLogInput,
  UpdateHoursLogInput,
  CreateAttendanceRecordInput,
  UpdateAttendanceRecordInput,
  HoursSummary,
} from '@/domain/entities/hours-log.entity';
import { DrizzleHoursLogRepository } from '@/infrastructure/persistence/repositories/hours-log.repository';
import { DrizzleAttendanceRecordRepository } from '@/infrastructure/persistence/repositories/attendance-record.repository';

class HoursLogServiceAdapter {
  private hoursLogRepo = new DrizzleHoursLogRepository();
  private attendanceRepo = new DrizzleAttendanceRecordRepository();

  // ==============================================================================
  // Hours Log Methods
  // ==============================================================================

  async createHoursLog(input: CreateHoursLogInput): Promise<HoursLog> {
    return this.hoursLogRepo.create(input);
  }

  async getHoursLogById(id: string): Promise<HoursLog | null> {
    return this.hoursLogRepo.findById(id);
  }

  async getHoursLogsByTrainerId(trainerId: string): Promise<HoursLog[]> {
    return this.hoursLogRepo.findByTrainerId(trainerId);
  }

  async getAllHoursLogs(): Promise<HoursLog[]> {
    return this.hoursLogRepo.findAll();
  }

  async getHoursLogsByDateRange(startDate: string, endDate: string): Promise<HoursLog[]> {
    return this.hoursLogRepo.findByDateRange(startDate, endDate);
  }

  async getHoursLogsByStatus(status: HoursLog['status']): Promise<HoursLog[]> {
    return this.hoursLogRepo.findByStatus(status);
  }

  async updateHoursLog(id: string, input: UpdateHoursLogInput): Promise<HoursLog | null> {
    return this.hoursLogRepo.update(id, input);
  }

  async approveHoursLog(id: string, approvedBy: string): Promise<HoursLog | null> {
    return this.hoursLogRepo.approve(id, approvedBy);
  }

  async rejectHoursLog(id: string, approvedBy: string): Promise<HoursLog | null> {
    return this.hoursLogRepo.reject(id, approvedBy);
  }

  async deleteHoursLog(id: string): Promise<boolean> {
    await this.hoursLogRepo.delete(id);
    return true;
  }

  async getHoursSummaryForTrainer(trainerId: string): Promise<HoursSummary> {
    return this.hoursLogRepo.getSummaryForTrainer(trainerId);
  }

  async getAllHoursSummaries(): Promise<HoursSummary[]> {
    return this.hoursLogRepo.getAllSummaries();
  }

  // ==============================================================================
  // Attendance Record Methods
  // ==============================================================================

  async createAttendanceRecord(input: CreateAttendanceRecordInput): Promise<AttendanceRecord> {
    return this.attendanceRepo.create(input);
  }

  async getAttendanceRecordById(id: string): Promise<AttendanceRecord | null> {
    return this.attendanceRepo.findById(id);
  }

  async getAttendanceRecordsBySessionId(sessionId: string): Promise<AttendanceRecord[]> {
    return this.attendanceRepo.findBySessionId(sessionId);
  }

  async getAttendanceRecordsByTrainerId(trainerId: string): Promise<AttendanceRecord[]> {
    return this.attendanceRepo.findByTrainerId(trainerId);
  }

  async getAttendanceRecordsByParticipantId(participantId: string): Promise<AttendanceRecord[]> {
    return this.attendanceRepo.findByParticipantId(participantId);
  }

  async getAllAttendanceRecords(): Promise<AttendanceRecord[]> {
    return this.attendanceRepo.findAll();
  }

  async getAttendanceRecordsByDateRange(
    startDate: string,
    endDate: string
  ): Promise<AttendanceRecord[]> {
    return this.attendanceRepo.findByDateRange(startDate, endDate);
  }

  async updateAttendanceRecord(
    id: string,
    input: UpdateAttendanceRecordInput
  ): Promise<AttendanceRecord | null> {
    return this.attendanceRepo.update(id, input);
  }

  async deleteAttendanceRecord(id: string): Promise<boolean> {
    await this.attendanceRepo.delete(id);
    return true;
  }
}

// Export singleton instance
export const hoursLogService = new HoursLogServiceAdapter();

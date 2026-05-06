/**
 * Hours Log Service Adapter
 *
 * Provides a unified interface for hours log and attendance operations,
 * switching between in-memory (legacy) and repository pattern (new) based on feature flags.
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
import { HoursLogService } from './hours-log.service';
import { DrizzleHoursLogRepository } from '@/infrastructure/persistence/repositories/hours-log.repository';
import { DrizzleAttendanceRecordRepository } from '@/infrastructure/persistence/repositories/attendance-record.repository';
import { FeatureFlags } from '@/lib/features/feature-flags';

class HoursLogServiceAdapter {
  private hoursLogRepo = new DrizzleHoursLogRepository();
  private attendanceRepo = new DrizzleAttendanceRecordRepository();

  // ==============================================================================
  // Hours Log Methods
  // ==============================================================================

  async createHoursLog(input: CreateHoursLogInput): Promise<HoursLog> {
    if (FeatureFlags.USE_ATTENDANCE_REPOSITORY) {
      return this.hoursLogRepo.create(input);
    }
    return HoursLogService.createHoursLog(input);
  }

  async getHoursLogById(id: string): Promise<HoursLog | null> {
    if (FeatureFlags.USE_ATTENDANCE_REPOSITORY) {
      return this.hoursLogRepo.findById(id);
    }
    return HoursLogService.getHoursLogById(id);
  }

  async getHoursLogsByTrainerId(trainerId: string): Promise<HoursLog[]> {
    if (FeatureFlags.USE_ATTENDANCE_REPOSITORY) {
      return this.hoursLogRepo.findByTrainerId(trainerId);
    }
    return HoursLogService.getHoursLogsByTrainerId(trainerId);
  }

  async getAllHoursLogs(): Promise<HoursLog[]> {
    if (FeatureFlags.USE_ATTENDANCE_REPOSITORY) {
      return this.hoursLogRepo.findAll();
    }
    return HoursLogService.getAllHoursLogs();
  }

  async getHoursLogsByDateRange(startDate: string, endDate: string): Promise<HoursLog[]> {
    if (FeatureFlags.USE_ATTENDANCE_REPOSITORY) {
      return this.hoursLogRepo.findByDateRange(startDate, endDate);
    }
    return HoursLogService.getHoursLogsByDateRange(startDate, endDate);
  }

  async getHoursLogsByStatus(status: HoursLog['status']): Promise<HoursLog[]> {
    if (FeatureFlags.USE_ATTENDANCE_REPOSITORY) {
      return this.hoursLogRepo.findByStatus(status);
    }
    return HoursLogService.getHoursLogsByStatus(status);
  }

  async updateHoursLog(id: string, input: UpdateHoursLogInput): Promise<HoursLog | null> {
    if (FeatureFlags.USE_ATTENDANCE_REPOSITORY) {
      return this.hoursLogRepo.update(id, input);
    }
    return HoursLogService.updateHoursLog(id, input);
  }

  async approveHoursLog(id: string, approvedBy: string): Promise<HoursLog | null> {
    if (FeatureFlags.USE_ATTENDANCE_REPOSITORY) {
      return this.hoursLogRepo.approve(id, approvedBy);
    }
    return HoursLogService.approveHoursLog(id, approvedBy);
  }

  async rejectHoursLog(id: string, approvedBy: string): Promise<HoursLog | null> {
    if (FeatureFlags.USE_ATTENDANCE_REPOSITORY) {
      return this.hoursLogRepo.reject(id, approvedBy);
    }
    return HoursLogService.rejectHoursLog(id, approvedBy);
  }

  async deleteHoursLog(id: string): Promise<boolean> {
    if (FeatureFlags.USE_ATTENDANCE_REPOSITORY) {
      await this.hoursLogRepo.delete(id);
      return true;
    }
    return HoursLogService.deleteHoursLog(id);
  }

  async getHoursSummaryForTrainer(trainerId: string): Promise<HoursSummary> {
    if (FeatureFlags.USE_ATTENDANCE_REPOSITORY) {
      return this.hoursLogRepo.getSummaryForTrainer(trainerId);
    }
    return HoursLogService.getHoursSummaryForTrainer(trainerId);
  }

  async getAllHoursSummaries(): Promise<HoursSummary[]> {
    if (FeatureFlags.USE_ATTENDANCE_REPOSITORY) {
      return this.hoursLogRepo.getAllSummaries();
    }
    return HoursLogService.getAllHoursSummaries();
  }

  // ==============================================================================
  // Attendance Record Methods
  // ==============================================================================

  async createAttendanceRecord(input: CreateAttendanceRecordInput): Promise<AttendanceRecord> {
    if (FeatureFlags.USE_ATTENDANCE_REPOSITORY) {
      return this.attendanceRepo.create(input);
    }
    return HoursLogService.createAttendanceRecord(input);
  }

  async getAttendanceRecordById(id: string): Promise<AttendanceRecord | null> {
    if (FeatureFlags.USE_ATTENDANCE_REPOSITORY) {
      return this.attendanceRepo.findById(id);
    }
    return HoursLogService.getAttendanceRecordById(id);
  }

  async getAttendanceRecordsBySessionId(sessionId: string): Promise<AttendanceRecord[]> {
    if (FeatureFlags.USE_ATTENDANCE_REPOSITORY) {
      return this.attendanceRepo.findBySessionId(sessionId);
    }
    return HoursLogService.getAttendanceRecordsBySessionId(sessionId);
  }

  async getAttendanceRecordsByTrainerId(trainerId: string): Promise<AttendanceRecord[]> {
    if (FeatureFlags.USE_ATTENDANCE_REPOSITORY) {
      return this.attendanceRepo.findByTrainerId(trainerId);
    }
    return HoursLogService.getAttendanceRecordsByTrainerId(trainerId);
  }

  async getAttendanceRecordsByParticipantId(participantId: string): Promise<AttendanceRecord[]> {
    if (FeatureFlags.USE_ATTENDANCE_REPOSITORY) {
      return this.attendanceRepo.findByParticipantId(participantId);
    }
    return HoursLogService.getAttendanceRecordsByParticipantId(participantId);
  }

  async getAllAttendanceRecords(): Promise<AttendanceRecord[]> {
    if (FeatureFlags.USE_ATTENDANCE_REPOSITORY) {
      return this.attendanceRepo.findAll();
    }
    return HoursLogService.getAllAttendanceRecords();
  }

  async getAttendanceRecordsByDateRange(
    startDate: string,
    endDate: string
  ): Promise<AttendanceRecord[]> {
    if (FeatureFlags.USE_ATTENDANCE_REPOSITORY) {
      return this.attendanceRepo.findByDateRange(startDate, endDate);
    }
    return HoursLogService.getAttendanceRecordsByDateRange(startDate, endDate);
  }

  async updateAttendanceRecord(
    id: string,
    input: UpdateAttendanceRecordInput
  ): Promise<AttendanceRecord | null> {
    if (FeatureFlags.USE_ATTENDANCE_REPOSITORY) {
      return this.attendanceRepo.update(id, input);
    }
    return HoursLogService.updateAttendanceRecord(id, input);
  }

  async deleteAttendanceRecord(id: string): Promise<boolean> {
    if (FeatureFlags.USE_ATTENDANCE_REPOSITORY) {
      await this.attendanceRepo.delete(id);
      return true;
    }
    return HoursLogService.deleteAttendanceRecord(id);
  }

  // ==============================================================================
  // Feature Flag Status
  // ==============================================================================

  isUsingRepository(): boolean {
    return FeatureFlags.USE_ATTENDANCE_REPOSITORY;
  }
}

// Export singleton instance
export const hoursLogService = new HoursLogServiceAdapter();

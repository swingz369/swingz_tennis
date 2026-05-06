// Import and export types for use in implementations
import type {
  HoursLog,
  AttendanceRecord,
  CreateHoursLogInput,
  UpdateHoursLogInput,
  CreateAttendanceRecordInput,
  UpdateAttendanceRecordInput,
  HoursSummary,
} from '../entities/hours-log.entity';

export type {
  HoursLog,
  AttendanceRecord,
  CreateHoursLogInput,
  UpdateHoursLogInput,
  CreateAttendanceRecordInput,
  UpdateAttendanceRecordInput,
  HoursSummary,
} from '../entities/hours-log.entity';

/**
 * Repository interface for hours logs (trainer time tracking)
 */
export interface HoursLogRepository {
  /**
   * Create a new hours log
   */
  create(input: CreateHoursLogInput): Promise<HoursLog>;

  /**
   * Find hours log by ID
   */
  findById(id: string): Promise<HoursLog | null>;

  /**
   * Find hours logs by trainer ID
   */
  findByTrainerId(trainerId: string): Promise<HoursLog[]>;

  /**
   * Find all hours logs
   */
  findAll(): Promise<HoursLog[]>;

  /**
   * Find hours logs by date range
   */
  findByDateRange(startDate: string, endDate: string): Promise<HoursLog[]>;

  /**
   * Find hours logs by status
   */
  findByStatus(status: HoursLog['status']): Promise<HoursLog[]>;

  /**
   * Update a hours log
   */
  update(id: string, input: UpdateHoursLogInput): Promise<HoursLog | null>;

  /**
   * Approve a hours log
   */
  approve(id: string, approvedBy: string): Promise<HoursLog | null>;

  /**
   * Reject a hours log
   */
  reject(id: string, approvedBy: string): Promise<HoursLog | null>;

  /**
   * Delete a hours log
   */
  delete(id: string): Promise<void>;

  /**
   * Get hours summary for a trainer
   */
  getSummaryForTrainer(trainerId: string): Promise<HoursSummary>;

  /**
   * Get all hours summaries
   */
  getAllSummaries(): Promise<HoursSummary[]>;
}

/**
 * Repository interface for attendance records (session participant tracking)
 */
export interface AttendanceRecordRepository {
  /**
   * Create a new attendance record
   */
  create(input: CreateAttendanceRecordInput): Promise<AttendanceRecord>;

  /**
   * Find attendance record by ID
   */
  findById(id: string): Promise<AttendanceRecord | null>;

  /**
   * Find attendance records by session ID
   */
  findBySessionId(sessionId: string): Promise<AttendanceRecord[]>;

  /**
   * Find attendance records by trainer ID
   */
  findByTrainerId(trainerId: string): Promise<AttendanceRecord[]>;

  /**
   * Find attendance records by participant ID
   */
  findByParticipantId(participantId: string): Promise<AttendanceRecord[]>;

  /**
   * Find all attendance records
   */
  findAll(): Promise<AttendanceRecord[]>;

  /**
   * Find attendance records by date range
   */
  findByDateRange(startDate: string, endDate: string): Promise<AttendanceRecord[]>;

  /**
   * Update an attendance record
   */
  update(id: string, input: UpdateAttendanceRecordInput): Promise<AttendanceRecord | null>;

  /**
   * Delete an attendance record
   */
  delete(id: string): Promise<void>;
}

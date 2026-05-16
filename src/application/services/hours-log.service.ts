import type {
  HoursLog,
  AttendanceRecord,
  CreateHoursLogInput,
  UpdateHoursLogInput,
  CreateAttendanceRecordInput,
  UpdateAttendanceRecordInput,
  HoursSummary,
} from '../../domain/entities/hours-log.entity';

export class HoursLogService {
  private static hoursLogs: HoursLog[] = [];
  private static attendanceRecords: AttendanceRecord[] = [];

  /**
   * Generate a unique ID
   */
  private static generateId(): string {
    return `hours-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate hours log input
   */
  static validateHoursLogInput(input: CreateHoursLogInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.trainerId || input.trainerId.trim().length === 0) {
      errors.push('Trainer-ID ist erforderlich');
    }

    if (!input.trainerName || input.trainerName.trim().length < 2) {
      errors.push('Trainer-Name muss mindestens 2 Zeichen lang sein');
    }

    if (!input.date || !this.isValidDate(input.date)) {
      errors.push('Ungültiges Datum');
    }

    if (!input.startTime || !this.isValidTime(input.startTime)) {
      errors.push('Ungültige Startzeit');
    }

    if (!input.endTime || !this.isValidTime(input.endTime)) {
      errors.push('Ungültige Endzeit');
    }

    if (input.startTime && input.endTime && input.startTime >= input.endTime) {
      errors.push('Startzeit muss vor Endzeit liegen');
    }

    if (!input.type) {
      errors.push('Typ ist erforderlich');
    }

    const duration = this.calculateDuration(input.startTime, input.endTime);
    if (duration > 720) {
      errors.push('Maximal 12 Stunden pro Eintrag erlaubt');
    }

    const today = new Date().toISOString().split('T')[0];
    if (input.date && input.date > today) {
      errors.push('Datum darf nicht in der Zukunft liegen');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate attendance record input
   */
  static validateAttendanceRecordInput(input: CreateAttendanceRecordInput): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!input.sessionId || input.sessionId.trim().length === 0) {
      errors.push('Session-ID ist erforderlich');
    }

    if (!input.trainerId || input.trainerId.trim().length === 0) {
      errors.push('Trainer-ID ist erforderlich');
    }

    if (!input.trainerName || input.trainerName.trim().length < 2) {
      errors.push('Trainer-Name muss mindestens 2 Zeichen lang sein');
    }

    if (!input.participantId || input.participantId.trim().length === 0) {
      errors.push('Teilnehmer-ID ist erforderlich');
    }

    if (!input.participantName || input.participantName.trim().length < 2) {
      errors.push('Teilnehmer-Name muss mindestens 2 Zeichen lang sein');
    }

    if (!input.date || !this.isValidDate(input.date)) {
      errors.push('Ungültiges Datum');
    }

    if (!input.status) {
      errors.push('Status ist erforderlich');
    }

    if (input.checkInTime && !this.isValidTime(input.checkInTime)) {
      errors.push('Ungültige Check-in Zeit');
    }

    if (input.checkOutTime && !this.isValidTime(input.checkOutTime)) {
      errors.push('Ungültige Check-out Zeit');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate date format
   */
  private static isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  /**
   * Validate time format
   */
  private static isValidTime(timeString: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeString);
  }

  /**
   * Calculate duration in minutes
   */
  private static calculateDuration(startTime: string, endTime: string): number {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);

    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;

    return endTotalMinutes - startTotalMinutes;
  }

  /**
   * Create a new hours log
   */
  static async createHoursLog(input: CreateHoursLogInput): Promise<HoursLog> {
    const validation = this.validateHoursLogInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const duration = this.calculateDuration(input.startTime, input.endTime);

    const now = new Date().toISOString();
    const hoursLog: HoursLog = {
      id: this.generateId(),
      trainerId: input.trainerId,
      trainerName: input.trainerName,
      sessionId: input.sessionId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      duration,
      type: input.type,
      status: 'pending',
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    this.hoursLogs.push(hoursLog);
    return hoursLog;
  }

  /**
   * Get hours log by ID
   */
  static async getHoursLogById(id: string): Promise<HoursLog | null> {
    return this.hoursLogs.find((h) => h.id === id) || null;
  }

  /**
   * Get hours logs by trainer ID
   */
  static async getHoursLogsByTrainerId(trainerId: string): Promise<HoursLog[]> {
    return this.hoursLogs.filter((h) => h.trainerId === trainerId);
  }

  /**
   * Get all hours logs
   */
  static async getAllHoursLogs(): Promise<HoursLog[]> {
    return [...this.hoursLogs];
  }

  /**
   * Get hours logs by date range
   */
  static async getHoursLogsByDateRange(startDate: string, endDate: string): Promise<HoursLog[]> {
    return this.hoursLogs.filter((h) => h.date >= startDate && h.date <= endDate);
  }

  /**
   * Get hours logs by status
   */
  static async getHoursLogsByStatus(status: HoursLog['status']): Promise<HoursLog[]> {
    return this.hoursLogs.filter((h) => h.status === status);
  }

  /**
   * Update hours log
   */
  static async updateHoursLog(id: string, input: UpdateHoursLogInput): Promise<HoursLog | null> {
    const index = this.hoursLogs.findIndex((h) => h.id === id);
    if (index === -1) {
      return null;
    }

    const existing = this.hoursLogs[index];

    if (existing.status === 'approved') {
      throw new Error('Genehmigte Einträge können nicht mehr bearbeitet werden');
    }

    const duration =
      input.startTime && input.endTime
        ? this.calculateDuration(input.startTime, input.endTime)
        : existing.duration;

    if (duration > 720) {
      throw new Error('Maximal 12 Stunden pro Eintrag erlaubt');
    }

    const updated: HoursLog = {
      ...existing,
      ...input,
      duration,
      updatedAt: new Date().toISOString(),
    };

    this.hoursLogs[index] = updated;
    return updated;
  }

  /**
   * Approve hours log
   */
  static async approveHoursLog(id: string, approvedBy: string): Promise<HoursLog | null> {
    const updated = await this.updateHoursLog(id, {
      status: 'approved',
      approvedBy,
      approvedAt: new Date().toISOString(),
    });

    return updated;
  }

  /**
   * Reject hours log
   */
  static async rejectHoursLog(id: string, approvedBy: string): Promise<HoursLog | null> {
    const updated = await this.updateHoursLog(id, {
      status: 'rejected',
      approvedBy,
      approvedAt: new Date().toISOString(),
    });

    return updated;
  }

  /**
   * Delete hours log
   */
  static async deleteHoursLog(id: string): Promise<boolean> {
    const index = this.hoursLogs.findIndex((h) => h.id === id);
    if (index === -1) {
      return false;
    }

    this.hoursLogs.splice(index, 1);
    return true;
  }

  /**
   * Create a new attendance record
   */
  static async createAttendanceRecord(
    input: CreateAttendanceRecordInput
  ): Promise<AttendanceRecord> {
    const validation = this.validateAttendanceRecordInput(input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const now = new Date().toISOString();
    const attendanceRecord: AttendanceRecord = {
      id: this.generateId(),
      sessionId: input.sessionId,
      trainerId: input.trainerId,
      trainerName: input.trainerName,
      participantId: input.participantId,
      participantName: input.participantName,
      date: input.date,
      status: input.status,
      checkInTime: input.checkInTime,
      checkOutTime: input.checkOutTime,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    this.attendanceRecords.push(attendanceRecord);
    return attendanceRecord;
  }

  /**
   * Get attendance record by ID
   */
  static async getAttendanceRecordById(id: string): Promise<AttendanceRecord | null> {
    return this.attendanceRecords.find((a) => a.id === id) || null;
  }

  /**
   * Get attendance records by session ID
   */
  static async getAttendanceRecordsBySessionId(sessionId: string): Promise<AttendanceRecord[]> {
    return this.attendanceRecords.filter((a) => a.sessionId === sessionId);
  }

  /**
   * Get attendance records by trainer ID
   */
  static async getAttendanceRecordsByTrainerId(trainerId: string): Promise<AttendanceRecord[]> {
    return this.attendanceRecords.filter((a) => a.trainerId === trainerId);
  }

  /**
   * Get attendance records by participant ID
   */
  static async getAttendanceRecordsByParticipantId(
    participantId: string
  ): Promise<AttendanceRecord[]> {
    return this.attendanceRecords.filter((a) => a.participantId === participantId);
  }

  /**
   * Get all attendance records
   */
  static async getAllAttendanceRecords(): Promise<AttendanceRecord[]> {
    return [...this.attendanceRecords];
  }

  /**
   * Get attendance records by date range
   */
  static async getAttendanceRecordsByDateRange(
    startDate: string,
    endDate: string
  ): Promise<AttendanceRecord[]> {
    return this.attendanceRecords.filter((a) => a.date >= startDate && a.date <= endDate);
  }

  /**
   * Update attendance record
   */
  static async updateAttendanceRecord(
    id: string,
    input: UpdateAttendanceRecordInput
  ): Promise<AttendanceRecord | null> {
    const index = this.attendanceRecords.findIndex((a) => a.id === id);
    if (index === -1) {
      return null;
    }

    const existing = this.attendanceRecords[index];
    const updated: AttendanceRecord = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    this.attendanceRecords[index] = updated;
    return updated;
  }

  /**
   * Delete attendance record
   */
  static async deleteAttendanceRecord(id: string): Promise<boolean> {
    const index = this.attendanceRecords.findIndex((a) => a.id === id);
    if (index === -1) {
      return false;
    }

    this.attendanceRecords.splice(index, 1);
    return true;
  }

  /**
   * Get hours summary for a trainer
   */
  static async getHoursSummaryForTrainer(trainerId: string): Promise<HoursSummary> {
    const trainerLogs = this.hoursLogs.filter((h) => h.trainerId === trainerId);

    const totalHours = trainerLogs.reduce((sum, h) => sum + h.duration, 0) / 60;
    const trainingHours =
      trainerLogs.filter((h) => h.type === 'training').reduce((sum, h) => sum + h.duration, 0) / 60;
    const preparationHours =
      trainerLogs.filter((h) => h.type === 'preparation').reduce((sum, h) => sum + h.duration, 0) /
      60;
    const meetingHours =
      trainerLogs.filter((h) => h.type === 'meeting').reduce((sum, h) => sum + h.duration, 0) / 60;
    const otherHours =
      trainerLogs.filter((h) => h.type === 'other').reduce((sum, h) => sum + h.duration, 0) / 60;

    const pendingHours =
      trainerLogs.filter((h) => h.status === 'pending').reduce((sum, h) => sum + h.duration, 0) /
      60;
    const approvedHours =
      trainerLogs.filter((h) => h.status === 'approved').reduce((sum, h) => sum + h.duration, 0) /
      60;
    const rejectedHours =
      trainerLogs.filter((h) => h.status === 'rejected').reduce((sum, h) => sum + h.duration, 0) /
      60;

    const trainer = trainerLogs[0];

    return {
      trainerId,
      trainerName: trainer?.trainerName || 'Unbekannt',
      totalHours,
      trainingHours,
      preparationHours,
      meetingHours,
      otherHours,
      pendingHours,
      approvedHours,
      rejectedHours,
    };
  }

  /**
   * Get all hours summaries
   */
  static async getAllHoursSummaries(): Promise<HoursSummary[]> {
    const trainerIds = new Set(this.hoursLogs.map((h) => h.trainerId));
    const summaries: HoursSummary[] = [];

    for (const trainerId of trainerIds) {
      const summary = await this.getHoursSummaryForTrainer(trainerId);
      summaries.push(summary);
    }

    return summaries;
  }

  /**
   * Initialize with mock data (for development)
   */
  static initializeMockData(): void {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    this.hoursLogs = [
      {
        id: 'hours-1',
        trainerId: 'trainer-1',
        trainerName: 'Thomas Müller',
        sessionId: 'session-1',
        date: today,
        startTime: '09:00',
        endTime: '10:00',
        duration: 60,
        type: 'training',
        status: 'approved',
        approvedBy: 'Admin',
        approvedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        notes: 'Gutes Training',
        createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'hours-2',
        trainerId: 'trainer-1',
        trainerName: 'Thomas Müller',
        sessionId: 'session-2',
        date: today,
        startTime: '10:00',
        endTime: '11:30',
        duration: 90,
        type: 'training',
        status: 'pending',
        notes: 'Gruppentraining',
        createdAt: new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'hours-3',
        trainerId: 'trainer-2',
        trainerName: 'Julia Weber',
        sessionId: 'session-3',
        date: today,
        startTime: '14:00',
        endTime: '15:00',
        duration: 60,
        type: 'training',
        status: 'approved',
        approvedBy: 'Admin',
        approvedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
        notes: 'Probetraining',
        createdAt: new Date(now.getTime() - 22 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
      },
    ];

    this.attendanceRecords = [
      {
        id: 'attendance-1',
        sessionId: 'session-1',
        trainerId: 'trainer-1',
        trainerName: 'Thomas Müller',
        participantId: 'p1',
        participantName: 'Max Mustermann',
        date: today,
        status: 'present',
        checkInTime: '08:55',
        checkOutTime: '10:05',
        createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'attendance-2',
        sessionId: 'session-2',
        trainerId: 'trainer-1',
        trainerName: 'Thomas Müller',
        participantId: 'p2',
        participantName: 'Anna Schmidt',
        date: today,
        status: 'present',
        checkInTime: '09:55',
        checkOutTime: '11:35',
        createdAt: new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'attendance-3',
        sessionId: 'session-2',
        trainerId: 'trainer-1',
        trainerName: 'Thomas Müller',
        participantId: 'p3',
        participantName: 'Peter Klein',
        date: today,
        status: 'late',
        checkInTime: '10:10',
        checkOutTime: '11:35',
        notes: 'Verspätet',
        createdAt: new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString(),
      },
    ];
  }
}

// Initialize mock data
if (process.env.NODE_ENV !== 'production') {
  HoursLogService.initializeMockData();
}

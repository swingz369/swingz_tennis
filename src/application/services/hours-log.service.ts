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
    const d = (days: number, hours = 0) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000 + hours * 60 * 60 * 1000).toISOString();
    const pastDate = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // ======= Hours Logs (18 entries — multiple trainers, types, statuses) =======
    this.hoursLogs = [
      // --- Trainer 1: Thomas Müller (approved + pending + rejected) ---
      {
        id: 'hours-1', trainerId: 'trainer-1', trainerName: 'Thomas Müller',
        sessionId: 'session-1', date: today, startTime: '09:00', endTime: '10:00',
        duration: 60, type: 'training', status: 'approved',
        approvedBy: 'Admin', approvedAt: d(0, -2), notes: 'Anfänger-Grundlagentraining',
        createdAt: d(-1), updatedAt: d(0, -2),
      },
      {
        id: 'hours-2', trainerId: 'trainer-1', trainerName: 'Thomas Müller',
        sessionId: 'session-2', date: today, startTime: '10:00', endTime: '11:30',
        duration: 90, type: 'training', status: 'pending',
        notes: 'Gruppentraining Fortgeschrittene', createdAt: d(-1), updatedAt: d(-1),
      },
      {
        id: 'hours-3', trainerId: 'trainer-1', trainerName: 'Thomas Müller',
        sessionId: 'session-4', date: today, startTime: '14:00', endTime: '15:30',
        duration: 90, type: 'training', status: 'pending',
        notes: 'Technik-Einheit Vorhand', createdAt: d(-1), updatedAt: d(-1),
      },
      {
        id: 'hours-4', trainerId: 'trainer-1', trainerName: 'Thomas Müller',
        sessionId: 'session-5', date: pastDate(1), startTime: '08:00', endTime: '10:00',
        duration: 120, type: 'preparation', status: 'approved',
        approvedBy: 'Admin', approvedAt: d(-1), notes: 'Trainingsvorbereitung Wochenplan',
        createdAt: d(-2), updatedAt: d(-1),
      },
      {
        id: 'hours-5', trainerId: 'trainer-1', trainerName: 'Thomas Müller',
        sessionId: 'session-6', date: pastDate(2), startTime: '16:00', endTime: '17:00',
        duration: 60, type: 'meeting', status: 'approved',
        approvedBy: 'Admin', approvedAt: d(-2), notes: 'Team-Meeting Saisonplanung',
        createdAt: d(-3), updatedAt: d(-2),
      },
      {
        id: 'hours-6', trainerId: 'trainer-1', trainerName: 'Thomas Müller',
        date: pastDate(3), startTime: '18:00', endTime: '19:30',
        duration: 90, type: 'other', status: 'rejected',
        approvedBy: 'Admin', approvedAt: d(-3), notes: 'Überstunden — nicht genehmigt',
        createdAt: d(-4), updatedAt: d(-3),
      },
      // --- Trainer 2: Julia Weber (approved + pending) ---
      {
        id: 'hours-7', trainerId: 'trainer-2', trainerName: 'Julia Weber',
        sessionId: 'session-3', date: today, startTime: '14:00', endTime: '15:00',
        duration: 60, type: 'training', status: 'approved',
        approvedBy: 'Admin', approvedAt: d(0, -1), notes: 'Probetraining — sehr erfolgreich',
        createdAt: d(-1), updatedAt: d(0, -1),
      },
      {
        id: 'hours-8', trainerId: 'trainer-2', trainerName: 'Julia Weber',
        sessionId: 'session-7', date: today, startTime: '15:00', endTime: '16:00',
        duration: 60, type: 'training', status: 'approved',
        approvedBy: 'Admin', approvedAt: d(0, -1), notes: 'Wettkampfvorbereitung Einzel',
        createdAt: d(-1), updatedAt: d(0, -1),
      },
      {
        id: 'hours-9', trainerId: 'trainer-2', trainerName: 'Julia Weber',
        sessionId: 'session-8', date: pastDate(1), startTime: '10:00', endTime: '12:00',
        duration: 120, type: 'training', status: 'approved',
        approvedBy: 'Admin', approvedAt: d(-1), notes: 'Doppel-Taktiktraining',
        createdAt: d(-2), updatedAt: d(-1),
      },
      {
        id: 'hours-10', trainerId: 'trainer-2', trainerName: 'Julia Weber',
        date: pastDate(2), startTime: '08:00', endTime: '09:00',
        duration: 60, type: 'preparation', status: 'approved',
        approvedBy: 'Admin', approvedAt: d(-2), notes: 'Videoanalyse Vorbereitung',
        createdAt: d(-3), updatedAt: d(-2),
      },
      {
        id: 'hours-11', trainerId: 'trainer-2', trainerName: 'Julia Weber',
        date: pastDate(4), startTime: '13:00', endTime: '14:30',
        duration: 90, type: 'meeting', status: 'pending',
        notes: 'Elternabend Jugendtraining', createdAt: d(-5), updatedAt: d(-5),
      },
      // --- Trainer 3: David Kruse (approved) ---
      {
        id: 'hours-12', trainerId: 'trainer-3', trainerName: 'David Kruse',
        sessionId: 'session-9', date: today, startTime: '08:00', endTime: '09:00',
        duration: 60, type: 'training', status: 'approved',
        approvedBy: 'Admin', approvedAt: d(0, -3), notes: 'Jugendtraining U12',
        createdAt: d(-2), updatedAt: d(0, -3),
      },
      {
        id: 'hours-13', trainerId: 'trainer-3', trainerName: 'David Kruse',
        sessionId: 'session-10', date: today, startTime: '09:00', endTime: '10:30',
        duration: 90, type: 'training', status: 'approved',
        approvedBy: 'Admin', approvedAt: d(0, -3), notes: 'Jugendtraining U16',
        createdAt: d(-2), updatedAt: d(0, -3),
      },
      {
        id: 'hours-14', trainerId: 'trainer-3', trainerName: 'David Kruse',
        date: pastDate(1), startTime: '15:00', endTime: '16:00',
        duration: 60, type: 'preparation', status: 'pending',
        notes: 'Materialvorbereitung Jugendcamp', createdAt: d(-2), updatedAt: d(-2),
      },
      // --- Trainer 4: Sabine Frost (mixed) ---
      {
        id: 'hours-15', trainerId: 'trainer-4', trainerName: 'Sabine Frost',
        sessionId: 'session-11', date: today, startTime: '11:00', endTime: '12:00',
        duration: 60, type: 'training', status: 'approved',
        approvedBy: 'Admin', approvedAt: d(0, -4), notes: 'Senioren-Fitness',
        createdAt: d(-1), updatedAt: d(0, -4),
      },
      {
        id: 'hours-16', trainerId: 'trainer-4', trainerName: 'Sabine Frost',
        sessionId: 'session-12', date: pastDate(1), startTime: '08:00', endTime: '09:30',
        duration: 90, type: 'training', status: 'approved',
        approvedBy: 'Admin', approvedAt: d(-1), notes: 'Frühgruppe Damen',
        createdAt: d(-2), updatedAt: d(-1),
      },
      {
        id: 'hours-17', trainerId: 'trainer-4', trainerName: 'Sabine Frost',
        date: pastDate(2), startTime: '12:00', endTime: '13:00',
        duration: 60, type: 'meeting', status: 'pending',
        notes: 'Feedbackgespräch Mitglieder', createdAt: d(-3), updatedAt: d(-3),
      },
      {
        id: 'hours-18', trainerId: 'trainer-4', trainerName: 'Sabine Frost',
        date: pastDate(5), startTime: '17:00', endTime: '18:30',
        duration: 90, type: 'other', status: 'approved',
        approvedBy: 'Admin', approvedAt: d(-5), notes: 'Turniervorbereitung Vereinsmeisterschaft',
        createdAt: d(-6), updatedAt: d(-5),
      },
    ];

    // ======= Attendance Records (12 entries — varied statuses) =======
    this.attendanceRecords = [
      { id: 'att-1', sessionId: 'session-1', trainerId: 'trainer-1', trainerName: 'Thomas Müller', participantId: 'member-1', participantName: 'Max Mustermann', date: today, status: 'present', checkInTime: '08:55', checkOutTime: '10:05', createdAt: d(-1), updatedAt: d(-1) },
      { id: 'att-2', sessionId: 'session-2', trainerId: 'trainer-1', trainerName: 'Thomas Müller', participantId: 'member-2', participantName: 'Anna Schmidt', date: today, status: 'present', checkInTime: '09:55', checkOutTime: '11:35', createdAt: d(-1), updatedAt: d(-1) },
      { id: 'att-3', sessionId: 'session-2', trainerId: 'trainer-1', trainerName: 'Thomas Müller', participantId: 'member-3', participantName: 'Peter Klein', date: today, status: 'late', checkInTime: '10:10', checkOutTime: '11:35', notes: '15 Min verspätet', createdAt: d(-1), updatedAt: d(-1) },
      { id: 'att-4', sessionId: 'session-4', trainerId: 'trainer-1', trainerName: 'Thomas Müller', participantId: 'member-5', participantName: 'Felix Hoffmann', date: today, status: 'present', checkInTime: '13:55', checkOutTime: '15:35', createdAt: d(-1), updatedAt: d(-1) },
      { id: 'att-5', sessionId: 'session-4', trainerId: 'trainer-1', trainerName: 'Thomas Müller', participantId: 'member-6', participantName: 'Laura Becker', date: today, status: 'absent', notes: 'Krank gemeldet', createdAt: d(-1), updatedAt: d(-1) },
      { id: 'att-6', sessionId: 'session-3', trainerId: 'trainer-2', trainerName: 'Julia Weber', participantId: 'member-4', participantName: 'Sophie Wagner', date: today, status: 'present', checkInTime: '13:50', checkOutTime: '15:05', createdAt: d(-1), updatedAt: d(-1) },
      { id: 'att-7', sessionId: 'session-7', trainerId: 'trainer-2', trainerName: 'Julia Weber', participantId: 'member-8', participantName: 'Nina Schwarz', date: today, status: 'present', checkInTime: '14:55', checkOutTime: '16:05', createdAt: d(-1), updatedAt: d(-1) },
      { id: 'att-8', sessionId: 'session-8', trainerId: 'trainer-2', trainerName: 'Julia Weber', participantId: 'member-10', participantName: 'Julia König', date: pastDate(1), status: 'present', checkInTime: '09:50', checkOutTime: '12:05', createdAt: d(-2), updatedAt: d(-2) },
      { id: 'att-9', sessionId: 'session-9', trainerId: 'trainer-3', trainerName: 'David Kruse', participantId: 'member-7', participantName: 'Lukas Fischer', date: today, status: 'present', checkInTime: '07:50', checkOutTime: '09:05', createdAt: d(-1), updatedAt: d(-1) },
      { id: 'att-10', sessionId: 'session-9', trainerId: 'trainer-3', trainerName: 'David Kruse', participantId: 'member-12', participantName: 'Elena Wolf', date: today, status: 'late', checkInTime: '08:20', checkOutTime: '09:05', notes: '20 Min verspätet — Zugausfall', createdAt: d(-1), updatedAt: d(-1) },
      { id: 'att-11', sessionId: 'session-11', trainerId: 'trainer-4', trainerName: 'Sabine Frost', participantId: 'member-20', participantName: 'Birgit Vogel', date: today, status: 'present', checkInTime: '10:50', checkOutTime: '12:05', createdAt: d(-1), updatedAt: d(-1) },
      { id: 'att-12', sessionId: 'session-12', trainerId: 'trainer-4', trainerName: 'Sabine Frost', participantId: 'member-2', participantName: 'Anna Schmidt', date: pastDate(1), status: 'present', checkInTime: '07:55', checkOutTime: '09:35', createdAt: d(-2), updatedAt: d(-2) },
    ];
  }
}

// Initialize mock data
if (process.env.NODE_ENV !== 'production') {
  HoursLogService.initializeMockData();
}

export interface HoursLog {
  id: string;
  trainerId: string;
  trainerName: string;
  sessionId?: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  type: 'training' | 'preparation' | 'meeting' | 'other';
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface CreateHoursLogInput {
  trainerId: string;
  trainerName: string;
  sessionId?: string;
  date: string;
  startTime: string;
  endTime: string;
  type: 'training' | 'preparation' | 'meeting' | 'other';
  notes?: string;
}

export interface UpdateHoursLogInput {
  startTime?: string;
  endTime?: string;
  type?: 'training' | 'preparation' | 'meeting' | 'other';
  status?: 'pending' | 'approved' | 'rejected';
  notes?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface CreateAttendanceRecordInput {
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
}

export interface UpdateAttendanceRecordInput {
  status?: 'present' | 'absent' | 'late' | 'excused';
  checkInTime?: string;
  checkOutTime?: string;
  notes?: string;
}

export interface HoursSummary {
  trainerId: string;
  trainerName: string;
  totalHours: number;
  trainingHours: number;
  preparationHours: number;
  meetingHours: number;
  otherHours: number;
  pendingHours: number;
  approvedHours: number;
  rejectedHours: number;
}

export interface Absence {
  id: string;
  trainerId: string;
  trainerName: string;
  type: 'sick' | 'vacation' | 'personal' | 'other';
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  notes?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAbsenceInput {
  trainerId: string;
  trainerName: string;
  type: 'sick' | 'vacation' | 'personal' | 'other';
  startDate: string;
  endDate: string;
  reason?: string;
  notes?: string;
}

export interface UpdateAbsenceInput {
  type?: 'sick' | 'vacation' | 'personal' | 'other';
  startDate?: string;
  endDate?: string;
  status?: 'pending' | 'approved' | 'rejected';
  reason?: string;
  notes?: string;
}

export interface AbsenceConflict {
  id: string;
  trainerId: string;
  trainerName: string;
  absenceId: string;
  conflictType: 'scheduled_session' | 'availability' | 'other';
  conflictingDate: string;
  conflictingWith: string[];
}

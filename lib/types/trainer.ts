/**
 * Trainer Availability Types
 * Based on TSOWAPP implementation
 */

export interface TrainerAvailability {
  id: string;
  user_id: string;
  club_id: string;
  day_of_week: number; // 0-6 (Sunday-Saturday)
  start_time: string; // HH:MM format
  end_time: string;
  is_available: boolean;
  max_sessions: number | null;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TrainerAbsence {
  id: string;
  user_id: string;
  club_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
  notes?: string;
  substitute_trainer_id?: string;
  created_at: string;
  updated_at: string;
}

export interface TrainerAssignment {
  id: string;
  user_id: string;
  club_id: string;
  hourly_rate: number;
  specialization: string[];
  max_students_per_session: number;
  bio?: string;
  qualifications: string[];
  languages: string[];
  is_active: boolean;
  start_date: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

export interface AvailableTrainer {
  user_id: string;
  full_name: string;
  specialization: string[];
  hourly_rate: number;
}

export interface TrainerWithDetails extends TrainerAssignment {
  full_name: string;
  email: string;
  avatar_url?: string;
  availability: TrainerAvailability[];
  upcoming_absences: TrainerAbsence[];
}

export interface WeeklyAvailability {
  [key: number]: TimeSlot[]; // day_of_week -> time slots
}

export interface TimeSlot {
  start_time: string;
  end_time: string;
  max_sessions: number | null;
  notes?: string;
}

export const DAY_NAMES: Record<number, string> = {
  0: 'Sonntag',
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
  6: 'Samstag',
};

export const SPECIALIZATIONS = [
  'beginner',
  'intermediate',
  'advanced',
  'kids',
  'seniors',
  'competition',
  'technique',
  'fitness',
] as const;

export type Specialization = (typeof SPECIALIZATIONS)[number];

export const SPECIALIZATION_LABELS: Record<Specialization, string> = {
  beginner: 'Anfänger',
  intermediate: 'Fortgeschritten',
  advanced: 'Profis',
  kids: 'Kinder',
  seniors: 'Senioren',
  competition: 'Wettkampf',
  technique: 'Technik',
  fitness: 'Fitness',
};

export const ABSENCE_REASONS = [
  'vacation',
  'sick',
  'training',
  'competition',
  'personal',
  'other',
] as const;

export type AbsenceReason = (typeof ABSENCE_REASONS)[number];

export const ABSENCE_REASON_LABELS: Record<AbsenceReason, string> = {
  vacation: 'Urlaub',
  sick: 'Krankheit',
  training: 'Fortbildung',
  competition: 'Wettkampf',
  personal: 'Privat',
  other: 'Sonstiges',
};

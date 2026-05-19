// Season Planning System Types
// Comprehensive type definitions for the season planning feature

import type {
  seasons,
  userTrainingPreferences,
  seasonPlanEntries,
  planningConflicts,
  seasonPlanningHistory,
} from '@/src/infrastructure/persistence/schema';

// ============================================
// DATABASE MODEL TYPES (from Drizzle schema)
// ============================================

export type Season = typeof seasons.$inferSelect;
export type NewSeason = typeof seasons.$inferInsert;

export type UserTrainingPreference = typeof userTrainingPreferences.$inferSelect;
export type NewUserTrainingPreference = typeof userTrainingPreferences.$inferInsert;

export type SeasonPlanEntry = typeof seasonPlanEntries.$inferSelect;
export type NewSeasonPlanEntry = typeof seasonPlanEntries.$inferInsert;

export type PlanningConflict = typeof planningConflicts.$inferSelect;
export type NewPlanningConflict = typeof planningConflicts.$inferInsert;

export type SeasonPlanningHistoryEntry = typeof seasonPlanningHistory.$inferSelect;
export type NewSeasonPlanningHistoryEntry = typeof seasonPlanningHistory.$inferInsert;

// ============================================
// ENUMS
// ============================================

export const SeasonType = {
  SUMMER: 'summer',
  WINTER: 'winter',
} as const;
export type SeasonType = (typeof SeasonType)[keyof typeof SeasonType];

export const PlanningStatus = {
  DRAFT: 'draft',
  COLLECTING_PREFERENCES: 'collecting_preferences',
  AUTO_PLANNING: 'auto_planning',
  MANUAL_REVIEW: 'manual_review',
  INVOICES_GENERATED: 'invoices_generated',
  PUBLISHED: 'published',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
} as const;
export type PlanningStatus = (typeof PlanningStatus)[keyof typeof PlanningStatus];

export const UserRole = {
  MEMBER: 'member',
  TRAINER: 'trainer',
  ADMIN: 'admin',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const SkillLevel = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  PROFESSIONAL: 'professional',
} as const;
export type SkillLevel = (typeof SkillLevel)[keyof typeof SkillLevel];

export const AgeGroup = {
  YOUTH: 'youth',
  ADULT: 'adult',
  SENIOR: 'senior',
} as const;
export type AgeGroup = (typeof AgeGroup)[keyof typeof AgeGroup];

export const DayOfWeek = {
  MONDAY: 0,
  TUESDAY: 1,
  WEDNESDAY: 2,
  THURSDAY: 3,
  FRIDAY: 4,
  SATURDAY: 5,
  SUNDAY: 6,
} as const;
export type DayOfWeek = (typeof DayOfWeek)[keyof typeof DayOfWeek];

export const EntryType = {
  TRAINING: 'training',
  TRIAL_LESSON: 'trial_lesson',
  GROUP_SESSION: 'group_session',
  PRIVATE_LESSON: 'private_lesson',
  TOURNAMENT: 'tournament',
} as const;
export type EntryType = (typeof EntryType)[keyof typeof EntryType];

export const PlanningSource = {
  AUTO: 'auto',
  MANUAL: 'manual',
  IMPORTED: 'imported',
  COPIED: 'copied',
} as const;
export type PlanningSource = (typeof PlanningSource)[keyof typeof PlanningSource];

export const EntryStatus = {
  PLANNED: 'planned',
  CONFIRMED: 'confirmed',
  PUBLISHED: 'published',
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
} as const;
export type EntryStatus = (typeof EntryStatus)[keyof typeof EntryStatus];

export const ConflictType = {
  TRAINER_DOUBLE_BOOKING: 'trainer_double_booking',
  COURT_DOUBLE_BOOKING: 'court_double_booking',
  USER_UNAVAILABLE: 'user_unavailable',
  GROUP_OVERLAP: 'group_overlap',
  CAPACITY_EXCEEDED: 'capacity_exceeded',
  PREFERENCE_MISMATCH: 'preference_mismatch',
  INVALID_TIMESLOT: 'invalid_timeslot',
  RESOURCE_NOT_AVAILABLE: 'resource_not_available',
  OTHER: 'other',
} as const;
export type ConflictType = (typeof ConflictType)[keyof typeof ConflictType];

export const ConflictSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;
export type ConflictSeverity = (typeof ConflictSeverity)[keyof typeof ConflictSeverity];

export const ConflictStatus = {
  OPEN: 'open',
  INVESTIGATING: 'investigating',
  RESOLVED: 'resolved',
  IGNORED: 'ignored',
  WONT_FIX: 'wont_fix',
} as const;
export type ConflictStatus = (typeof ConflictStatus)[keyof typeof ConflictStatus];

// ============================================
// STRUCTURED TYPES
// ============================================

export interface TimeSlot {
  start: string; // "HH:MM" format
  end: string; // "HH:MM" format
}

export interface WeeklyAvailability {
  monday: TimeSlot[];
  tuesday: TimeSlot[];
  wednesday: TimeSlot[];
  thursday: TimeSlot[];
  friday: TimeSlot[];
  saturday: TimeSlot[];
  sunday: TimeSlot[];
}

export interface ConflictTimeSlot {
  day_of_week: DayOfWeek;
  start_time: string; // "HH:MM:SS" format
  end_time: string; // "HH:MM:SS" format
}

export interface AutoPlanConfig {
  max_iterations: number;
  optimization_goals: OptimizationGoal[];
  allow_overbooking: boolean;
  prefer_consistent_timeslots: boolean;
  maxParticipantsPerSession?: number;
  preferredDays?: string[];
  preferredTimeSlots?: Array<{
    start: string;
    end: string;
    start_time?: string;
    end_time?: string;
  }>;
  skillLevels?: string[];
  avoidTrainerOverload?: boolean;
  balanceGroupSizes?: boolean;
}

export type OptimizationGoal =
  | 'minimize_conflicts'
  | 'balance_trainer_load'
  | 'maximize_preferences'
  | 'optimize_court_usage';

export interface AlgorithmMetrics {
  iterations: number;
  runtime_ms: number;
  score: number;
  conflicts_detected: number;
  preferences_matched: number;
  trainer_utilization: number;
  court_utilization: number;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

// Seasons
export interface CreateSeasonRequest {
  club_id: string;
  name: string;
  season_type: SeasonType;
  year: number;
  start_date: string; // ISO date string
  end_date: string; // ISO date string
  preferences_deadline?: string; // ISO date string
  description?: string;
  notes?: string;
  auto_plan_config?: Partial<AutoPlanConfig>;
}

export interface UpdateSeasonRequest {
  name?: string;
  start_date?: string;
  end_date?: string;
  preferences_deadline?: string;
  preferences_open?: boolean;
  planning_status?: PlanningStatus;
  description?: string;
  notes?: string;
  auto_plan_config?: Partial<AutoPlanConfig>;
}

export interface SeasonWithStats extends Season {
  total_preferences: number;
  submitted_preferences: number;
  planned_entries: number;
  open_conflicts: number;
  trainers_count: number;
  groups_covered: number;
}

// User Preferences
export interface SubmitPreferencesRequest {
  season_id: string;
  user_role: UserRole;
  preferred_level?: SkillLevel;
  preferred_age_group?: AgeGroup;
  preferred_group_ids?: string[];
  weekly_availability: WeeklyAvailability;
  unavailable_dates?: string[]; // ISO date strings
  max_sessions_per_week?: number; // For trainers
  preferred_court_ids?: string[];
  can_teach_groups?: string[];
  priority?: number; // 1-10
  special_requests?: string;
  notes?: string;
}

export interface UpdatePreferencesRequest extends Partial<SubmitPreferencesRequest> {
  is_submitted?: boolean;
}

// Plan Entries
export interface CreatePlanEntryRequest {
  season_id: string;
  trainer_id: string;
  court_id?: string;
  group_id?: string;
  day_of_week: DayOfWeek;
  start_time: string; // "HH:MM:SS" format
  end_time: string; // "HH:MM:SS" format
  duration_minutes: number;
  starts_from_week?: number;
  ends_at_week?: number;
  entry_type?: EntryType;
  planning_source?: PlanningSource;
  max_participants?: number;
  expected_participants?: string[];
  notes?: string;
  admin_notes?: string;
}

export interface UpdatePlanEntryRequest extends Partial<CreatePlanEntryRequest> {
  status?: EntryStatus;
}

export interface PlanEntryWithDetails extends SeasonPlanEntry {
  trainer_name: string;
  court_name?: string;
  group_name?: string;
  participant_count: number;
}

// Auto-Planning
export interface AutoPlanRequest {
  season_id: string;
  config?: Partial<AutoPlanConfig>;
  dry_run?: boolean; // Preview only, don't save
  use_ai?: boolean; // Use AI-powered scheduling (V2)
}

export interface AutoPlanResponse {
  success: boolean;
  season_id: string;
  metrics: AlgorithmMetrics;
  entries_created: number;
  conflicts_detected: number;
  warnings: string[];
  plan_entries?: PlanEntryWithDetails[]; // If dry_run=true
  conflicts?: PlanningConflict[]; // If dry_run=true
}

// Conflicts
export interface ResolveConflictRequest {
  resolution_action: string;
  resolution_notes?: string;
}

export interface ConflictWithDetails extends PlanningConflict {
  affected_entries: PlanEntryWithDetails[];
  trainer_name?: string;
  court_name?: string;
}

// ============================================
// UTILITY TYPES
// ============================================

export interface SeasonDates {
  start: Date;
  end: Date;
  totalWeeks: number;
  currentWeek?: number;
}

export interface TrainerAvailability {
  trainer_id: string;
  trainer_name: string;
  max_sessions_per_week: number;
  current_sessions: number;
  available_slots: Array<{
    day_of_week: DayOfWeek;
    time_slots: TimeSlot[];
  }>;
}

export interface CourtAvailability {
  court_id: string;
  court_name: string;
  occupied_slots: Array<{
    day_of_week: DayOfWeek;
    start_time: string;
    end_time: string;
    entry_id: string;
  }>;
}

export interface PlanningStatistics {
  season_id: string;
  total_entries: number;
  entries_by_type: Record<EntryType, number>;
  entries_by_status: Record<EntryStatus, number>;
  trainers_utilized: number;
  courts_utilized: number;
  groups_covered: number;
  avg_preference_match_score: number;
  avg_optimization_score: number;
  total_conflicts: number;
  open_conflicts: number;
  critical_conflicts: number;
  preferences_submitted: number;
  preferences_pending: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  message: string;
  severity: 'low' | 'medium' | 'high';
}

// ============================================
// FILTER AND QUERY TYPES
// ============================================

export interface SeasonFilter {
  club_id?: string;
  season_type?: SeasonType;
  year?: number;
  planning_status?: PlanningStatus | PlanningStatus[];
  is_active?: boolean;
  date_range?: {
    from: string;
    to: string;
  };
}

export interface PlanEntryFilter {
  season_id?: string;
  club_id?: string;
  trainer_id?: string;
  court_id?: string;
  group_id?: string;
  day_of_week?: DayOfWeek | DayOfWeek[];
  status?: EntryStatus | EntryStatus[];
  entry_type?: EntryType | EntryType[];
  planning_source?: PlanningSource;
}

export interface ConflictFilter {
  season_id?: string;
  club_id?: string;
  conflict_type?: ConflictType | ConflictType[];
  severity?: ConflictSeverity | ConflictSeverity[];
  status?: ConflictStatus | ConflictStatus[];
  trainer_id?: string;
  court_id?: string;
}

export interface PreferenceFilter {
  season_id?: string;
  club_id?: string;
  user_role?: UserRole;
  is_submitted?: boolean;
  preferred_level?: SkillLevel;
  preferred_age_group?: AgeGroup;
}

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface SeasonCardProps {
  season: SeasonWithStats;
  onEdit?: (season: Season) => void;
  onDelete?: (seasonId: string) => void;
  onViewDetails?: (seasonId: string) => void;
}

export interface PreferenceFormProps {
  season: Season;
  existingPreference?: UserTrainingPreference;
  onSubmit: (data: SubmitPreferencesRequest) => Promise<void>;
  onCancel: () => void;
}

export interface PlanEntryFormProps {
  season: Season;
  existingEntry?: SeasonPlanEntry;
  trainers: Array<{ id: string; name: string }>;
  courts: Array<{ id: string; name: string }>;
  groups: Array<{ id: string; name: string }>;
  onSubmit: (data: CreatePlanEntryRequest) => Promise<void>;
  onCancel: () => void;
}

export interface ConflictListProps {
  conflicts: ConflictWithDetails[];
  onResolve: (conflictId: string, data: ResolveConflictRequest) => Promise<void>;
  onIgnore: (conflictId: string) => Promise<void>;
}

export interface PlanningCalendarProps {
  season: Season;
  entries: PlanEntryWithDetails[];
  onEntryClick: (entry: SeasonPlanEntry) => void;
  onSlotClick?: (day: DayOfWeek, time: string) => void;
  readOnly?: boolean;
}

// ============================================
// HELPER TYPE GUARDS
// ============================================

export function isValidSeasonType(value: string): value is SeasonType {
  return Object.values(SeasonType).includes(value as SeasonType);
}

export function isValidPlanningStatus(value: string): value is PlanningStatus {
  return Object.values(PlanningStatus).includes(value as PlanningStatus);
}

export function isValidDayOfWeek(value: number): value is DayOfWeek {
  return value >= 0 && value <= 6;
}

export function isValidTimeSlot(slot: TimeSlot): boolean {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(slot.start) && timeRegex.test(slot.end) && slot.start < slot.end;
}

// Extended types for the KI Saisonplanung wizard system
// New DB table types + wizard step types + clustering internal types

import type {
  seasonWaitlists,
  trainerFeedback,
  seasonStatistics,
  seasonPlanningConfigs,
} from '@/src/infrastructure/persistence/season-planning-schema';
import type { SkillLevel, DayOfWeek, WeeklyAvailability } from '@/lib/types/season-planning';
import type { WeekInfo as HolidayWeekInfo } from '@/lib/season-planning/holidays';

// ============================================
// NEW DB TABLE TYPES
// ============================================

export type SeasonWaitlist = typeof seasonWaitlists.$inferSelect;
export type NewSeasonWaitlist = typeof seasonWaitlists.$inferInsert;

export type TrainerFeedbackEntry = typeof trainerFeedback.$inferSelect;
export type NewTrainerFeedback = typeof trainerFeedback.$inferInsert;

export type SeasonStatistics = typeof seasonStatistics.$inferSelect;
export type NewSeasonStatistics = typeof seasonStatistics.$inferInsert;

export type SeasonPlanningConfig = typeof seasonPlanningConfigs.$inferSelect;
export type NewSeasonPlanningConfig = typeof seasonPlanningConfigs.$inferInsert;

// ============================================
// WIZARD STEP DEFINITIONS
// ============================================

export const WizardStep = {
  CONFIGURE: 1,
  TRAINER_SCHEDULE: 2,
  PLAN_EDIT: 3,
  FINALIZE: 4,
} as const;
export type WizardStep = (typeof WizardStep)[keyof typeof WizardStep];

export interface WizardState {
  seasonId: string;
  clubId: string;
  currentStep: WizardStep;
  maxReachedStep: WizardStep;
  isReady: boolean;
  isProcessing: boolean;
  error: string | null;
  adminNotes: string;

  // Schritt 1: Konfigurieren
  selectedMemberIds: string[];
  promotedMemberIds: string[];
  preferencesResponseRate: number;
  slotFailureRates: Record<string, number>;
  incompatibleWishPartnerPairs: Array<{
    memberA: string;
    memberB: string;
    reason: string;
  }>;
  trainerUtilization: Record<string, { current: number; max: number; pct: number }>;
  planningConfig: {
    groupMaxSize: number;
    groupMinSize: number;
    maxNiveauLevelSteps: number;
    trainerUtilizationMaxPct: number;
    preferHistoricGroups: boolean;
    avoidHighFailureSlots: boolean;
    slotFailureThreshold: number;
    slotDurationMinutes: number;
    kidsGroupMaxSize: number;
    kidsGroupMinSize: number;
    // Auto-Plan options (merged from auto-plan page)
    maxIterations: number;
    optimizationGoals: string[];
    allowOverbooking: boolean;
    preferConsistentTimeslots: boolean;
    // Sonntag ist standardmäßig kein Trainingstag (Vereinsrealität, Arbeits-/
    // Ruhezeitregeln). Opt-in, Default false — siehe ClusteringConfig.includeSunday.
    includeSunday: boolean;
  };

  // Schritt 2: Plan bearbeiten
  clusteringResult: ClusteringResult | null;
  scheduleSlots: ScheduleSlot[];
  holidayWeeks: HolidayWeekInfo[];
  bundeslandCode: string | null;

  // Schritt 3: Abschließen
  conflicts: ConflictDetectionResult[];
  isConfirmed: boolean;
  publishedSessionIds: string[];
}

// ============================================
// CLUSTERING TYPES (Schritt 4)
// ============================================

export interface MemberWithDetails {
  id: string;
  name: string;
  email: string;
  skillLevel: SkillLevel;
  experienceMonths: number;
  attendanceQuote: number | null; // from last season
  readyForNextLevel: boolean;
  recommendedLevel: SkillLevel | null;
  promotedLevel: SkillLevel | null; // adjusted level for clustering
  availability: WeeklyAvailability;
  wishPartnerIds: string[];
  avoidMemberIds: string[];
  selfAssessedLevel: SkillLevel | null;
  previousGroupId: string | null;
  isMinor: boolean;
  maxSessionsPerWeek: number;
  preferredCourtIds: string[];
  preferredGroupIds: string[];
  priority: number;
}

export interface TrainerWithDetails {
  id: string;
  name: string;
  specialties: string[];
  maxHoursPerWeek: number;
  utilizationPct: number; // configured max (e.g. 80%)
  availability: WeeklyAvailability;
  maxSessionsPerWeek: number;
  preferredCourtIds: string[];
  canTeachGroups: string[];
  sessionsAssigned: number;
}

export interface CourtInfo {
  id: string;
  name: string;
  surface: string;
  isActive: boolean;
}

export interface GroupInfo {
  id: string;
  name: string;
  level: SkillLevel;
  ageGroup: string;
  // Q2-Audit (Punkt 11): individuelle Kapazität; null/undefined = globaler Default
  // aus season_planning_configs (group_max_size / kids_group_max_size).
  maxSize?: number | null;
}

export interface TimeSlotInfo {
  dayOfWeek: DayOfWeek;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  failureRate: number | null;
  failureWarning: boolean; // >= 30%
}

export interface GroupAssignment {
  groupId: string;
  groupName: string;
  trainerId: string;
  trainerName: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  courtId: string | null;
  courtName: string | null;
  // Q2-Audit (Punkt 11): effektive Kapazität dieser konkreten Zuweisung (Gruppen-
  // Override falls gesetzt, sonst ageGroup-Default aus der Config) — genutzt für
  // Kapazitätsprüfungen im Second-Pass/Extra-Sessions und für max_participants
  // beim Speichern.
  maxSize: number;
  memberIds: string[];
  memberDetails: Array<{
    memberId: string;
    memberName: string;
    niveauMatch: number; // 0-100%
    experienceMonths: number;
    groupExperienceSpan: string; // e.g. "6-10 Monate"
    wishPartnerFulfilled: boolean;
    wishPartnerNames: string[];
    isPromoted: boolean;
    assignmentReason: string;
  }>;
  waitlistIds: string[];
  waitlistDetails: Array<{
    memberId: string;
    memberName: string;
    position: number;
  }>;
  warnings: string[];
  conflictIds: string[];
}

export interface ClusteringResult {
  groups: GroupAssignment[];
  unassignedMembers: Array<{
    memberId: string;
    memberName: string;
    reason: string;
  }>;
  waitlistSummary: Array<{
    memberId: string;
    memberName: string;
    groupName: string;
    position: number;
    alternativeGroupName: string | null;
  }>;
  metrics: ClusteringMetrics;
  explanations: string[];
}

export interface ClusteringMetrics {
  totalMembers: number;
  totalGroups: number;
  totalTrainers: number;

  // Niveau match metrics
  avgNiveauMatch: number;
  niveauSpanViolations: number;

  // Wish partner metrics
  wishPartnerRequests: number;
  wishPartnerFulfilled: number;
  wishPartnerRate: number;

  // Trainer load
  avgTrainerUtilization: number;
  trainerOverloadWarnings: number;

  // Slot risk
  highRiskSlotsUsed: number;

  // Waitlist
  totalWaitlisted: number;

  // Runtime
  runtimeMs: number;
  iterations: number;
}

// ============================================
// CONFLICT DETECTION TYPES (Schritt 5)
// ============================================

export type ConflictSeverityLevel = 'critical' | 'warning' | 'info';

export type ConflictTypeCode =
  | 'trainer_double_booking'
  | 'member_double_booking'
  | 'no_trainer_assigned'
  | 'court_unavailable'
  | 'trainer_over_limit'
  | 'high_failure_rate_slot'
  | 'large_niveau_span'
  | 'avoid_partner_conflict'
  // Ergänzt 12.08.2026 nach dem QA-Durchlauf: alle drei Fälle traten in einem
  // Plan auf, den die Prüfung als "konfliktfrei" freigegeben hat.
  | 'no_court_assigned'
  | 'member_unavailable'
  | 'member_unplanned';

export interface ConflictDetectionResult {
  id: string;
  type: ConflictTypeCode;
  severity: ConflictSeverityLevel;
  description: string;
  suggestedResolution: string | null;
  affectedEntities: {
    trainerIds: string[];
    memberIds: string[];
    courtIds: string[];
    groupIds: string[];
    planEntryIds: string[];
  };
  timeSlot: {
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
  } | null;
  status: 'open' | 'resolved' | 'ignored';
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNotes: string | null;
}

// ============================================
// STATISTICS TYPES
// ============================================

export interface SlotFailureRate {
  dayOfWeek: number;
  startTime: string;
  failureRate: number;
  totalSessions: number;
  cancelledSessions: number;
}

export interface CrossSeasonStats {
  // Per-season metrics
  bySeason: Record<string, SeasonStatistics>;

  // Aggregated trends
  slotFailureRates: Record<string, SlotFailureRate>;
  avgAttendanceByTrainer: Record<string, number>;
  avgWaitlistDurationDays: number;
  overallWishPartnerFulfillmentRate: number;
  levelUpgradeRate: number;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface SelectMembersRequest {
  seasonId: string;
  memberIds: string[];
}

export interface SelectMembersResponse {
  success: boolean;
  selectedCount: number;
  promotedMembers: Array<{
    memberId: string;
    memberName: string;
    recommendedLevel: SkillLevel;
    trainerName: string;
  }>;
  waitlistCarryovers: Array<{
    memberId: string;
    memberName: string;
    previousSeason: string;
  }>;
}

export interface PreferencesSummary {
  totalMembers: number;
  submittedCount: number;
  responseRate: number;
  slotFailureWarnings: Array<{
    dayOfWeek: number;
    startTime: string;
    failureRate: number;
    warning: string;
  }>;
  incompatibleWishPartners: Array<{
    memberA: { id: string; name: string; level: SkillLevel };
    memberB: { id: string; name: string; level: SkillLevel };
    reason: string;
  }>;
}

export interface TrainerAvailabilitySummary {
  trainers: Array<{
    trainerId: string;
    trainerName: string;
    maxHoursPerWeek: number;
    maxUtilizationPct: number;
    effectiveMaxHours: number;
    currentAssignedHours: number;
    availableSlots: number;
    utilizationStatus: 'under' | 'optimal' | 'near_limit' | 'over';
  }>;
  overallUtilization: number;
  burnoutWarnings: string[];
}

export interface RunClusteringRequest {
  seasonId: string;
  config?: Partial<{
    maxNiveauSpanBeginner: number;
    maxNiveauSpanAdvanced: number;
    trainerUtilizationMaxPct: number;
    groupMaxSize: number;
    groupMinSize: number;
    kidsGroupMaxSize: number;
    kidsGroupMinSize: number;
    slotDurationMinutes: number;
    provenGroupThreshold: number;
    slotFailureThreshold: number;
    waitlistPriorityRule: string;
    preferHistoricGroups: boolean;
    avoidHighFailureSlots: boolean;
  }>;
  dryRun?: boolean;
}

export interface ConfirmPlanRequest {
  seasonId: string;
  /** @deprecated Ohne Wirkung — der Server liest die persistierten Konflikt-Entscheidungen. */
  acceptedWarnings?: string[];
  adminNotes: string;
}

export interface ConfirmPlanResponse {
  success: boolean;
  publishedSessions: number;
  publishedSessionIds: string[];
  notificationsSent: number;
  waitlistNotifications: number;
  unresolvedCriticalConflicts: string[];
}

// ============================================
// WIZARD CONTEXT TYPE
// ============================================

// ============================================
// SCHEDULE SLOT (for drag & drop grid)
// ============================================

export interface ScheduleSlot {
  id: string;
  groupName: string;
  groupColor: string;
  trainerId: string;
  trainerName: string;
  dayOfWeek: number; // 1=Mo .. 7=So
  startTime: string;
  endTime: string;
  durationMin: number;
  courtId: string | null;
  courtName: string | null;
  memberIds: string[];
  memberNames: string[];
}

// ============================================
// WIZARD CONTEXT TYPE
// ============================================

export interface WizardContextType {
  state: WizardState;
  goToStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  setMemberIds: (ids: string[]) => void;
  runClustering: (dryRun?: boolean) => Promise<void>;
  detectConflicts: () => Promise<void>;
  confirmPlan: () => Promise<ConfirmPlanResponse>;
  resetWizard: () => void;
}

// Enhanced Clustering Engine for KI Saisonplanung
// Implements Schritt 4a (hard constraints), 4b (soft constraints),
// 4c (niveau development), and 4d (waitlist logic)

import { db } from '@/src/infrastructure/persistence/db';
import {
  seasons,
  users,
  trainers,
  userTrainingPreferences,
  groups,
  courts,
  seasonPlanEntries,
  userClubMemberships,
  trainerClubs,
} from '@/src/infrastructure/persistence/schema';
import {
  seasonWaitlists,
  trainerFeedback,
  seasonStatistics,
  seasonPlanningConfigs,
} from '@/src/infrastructure/persistence/season-planning-schema';
import { and, eq, asc } from 'drizzle-orm';
import type { WeeklyAvailability, DayOfWeek, SkillLevel } from '@/lib/types/season-planning';
import type {
  MemberWithDetails,
  TrainerWithDetails,
  CourtInfo,
  GroupInfo,
  TimeSlotInfo,
  GroupAssignment,
  ClusteringResult,
  ClusteringMetrics,
} from '@/lib/season-planning/types';

// ============================================
// CONFIG DEFAULTS
// ============================================

interface ClusteringConfig {
  maxNiveauSpanBeginner: number; // months, default 4
  maxNiveauSpanAdvanced: number; // months, default 8
  trainerUtilizationMaxPct: number; // default 80
  groupMaxSize: number; // default 12
  groupMinSize: number; // default 3
  kidsGroupMaxSize: number; // default 6
  kidsGroupMinSize: number; // default 3
  slotDurationMinutes: number; // default 90
  provenGroupThreshold: number; // attendance pct, default 80
  slotFailureThreshold: number; // pct, default 30
  waitlistPriorityRule: string;
  preferHistoricGroups: boolean;
  avoidHighFailureSlots: boolean;
}

const DEFAULT_CONFIG: ClusteringConfig = {
  maxNiveauSpanBeginner: 4,
  maxNiveauSpanAdvanced: 8,
  trainerUtilizationMaxPct: 80,
  groupMaxSize: 12,
  groupMinSize: 3,
  kidsGroupMaxSize: 6,
  kidsGroupMinSize: 3,
  slotDurationMinutes: 90,
  provenGroupThreshold: 80,
  slotFailureThreshold: 30,
  waitlistPriorityRule: 'registration_time',
  preferHistoricGroups: true,
  avoidHighFailureSlots: true,
};

// ============================================
// TIME SLOTS (standard training times)
// ============================================

/**
 * Build standard training time slots from 08:00 to maxEndHour (default 21:00).
 * Slots are generated with the configured duration in minutes.
 * The last slot must start before maxEndHour to ensure it fits within court hours.
 */
function buildStandardTimeSlots(
  durationMinutes: number,
  maxEndHour: number = 21
): Array<{ start: string; end: string }> {
  const slots: Array<{ start: string; end: string }> = [];
  let hour = 8;
  let minute = 0;
  while (hour < maxEndHour) {
    const startH = hour.toString().padStart(2, '0');
    const startM = minute.toString().padStart(2, '0');
    const endTotal = hour * 60 + minute + durationMinutes;
    const endH = Math.floor(endTotal / 60)
      .toString()
      .padStart(2, '0');
    const endM = (endTotal % 60).toString().padStart(2, '0');

    // Only add if the slot ends by maxEndHour
    const endHour = Math.floor(endTotal / 60);
    if (endHour <= maxEndHour) {
      slots.push({ start: `${startH}:${startM}`, end: `${endH}:${endM}` });
    }

    minute += durationMinutes;
    while (minute >= 60) {
      hour++;
      minute -= 60;
    }
  }
  return slots;
}

const DAY_NAMES: Array<keyof WeeklyAvailability> = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const NEXT_LEVEL: Record<SkillLevel, SkillLevel> = {
  beginner: 'intermediate',
  intermediate: 'advanced',
  advanced: 'professional',
  professional: 'professional',
};

// ============================================
// ENGINE
// ============================================

export class SeasonClusteringEngine {
  private seasonId: string;
  private clubId: string;
  private config: ClusteringConfig;
  private startTime = 0;

  constructor(seasonId: string, clubId: string, config?: Partial<ClusteringConfig>) {
    this.seasonId = seasonId;
    this.clubId = clubId;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================
  // MAIN ENTRY POINT
  // ============================================

  async runClustering(dryRun: boolean = false): Promise<ClusteringResult> {
    this.startTime = Date.now();

    // Step 0: Load planning config from DB (overrides defaults)
    await this.loadConfig();

    // Step 1: Load all data
    const members = await this.loadMembers();
    const trainers = await this.loadTrainers();
    const courts = await this.loadCourts();
    const groups = await this.loadGroups();
    const slotFailureRates = await this.loadSlotFailureRates();
    const historicGroups = await this.loadHistoricGroups();

    // Step 2: Apply niveau promotions (Schritt 4c)
    this.applyNiveauPromotions(members);

    // Step 3: Build candidate groups from historic patterns (Schritt 4b)
    const candidateGroups = this.buildCandidateGroups(members, trainers, groups, historicGroups);

    // Step 4: Build dynamic time slots based on configured duration
    const timeSlots = buildStandardTimeSlots(this.config.slotDurationMinutes);

    // Step 5: Run greedy clustering with hard + soft constraints
    const { assignments, unassigned } = await this.greedyCluster(
      members,
      trainers,
      courts,
      candidateGroups,
      slotFailureRates,
      timeSlots
    );

    // Step 6: Apply waitlist logic (Schritt 4d)
    const waitlistResult = this.applyWaitlistLogic(assignments, members, groups);

    // Step 7: Compute metrics
    const metrics = this.computeMetrics(
      members,
      trainers,
      assignments,
      unassigned,
      waitlistResult.waitlisted
    );

    // Step 8: Generate explanations
    const explanations = this.generateExplanations(assignments, members, trainers);

    const result: ClusteringResult = {
      groups: assignments,
      unassignedMembers: unassigned.map((m) => ({
        memberId: m.id,
        memberName: m.name,
        reason: m._unassignedReason || 'Keine passende Gruppe gefunden',
      })),
      waitlistSummary: waitlistResult.summary,
      metrics,
      explanations,
    };

    // Step 9: Save to DB if not dry run
    if (!dryRun) {
      await this.saveToDatabase(result);
    }

    return result;
  }

  // ============================================
  // DATA LOADING
  // ============================================

  private async loadConfig(): Promise<void> {
    const [dbConfig] = await db
      .select()
      .from(seasonPlanningConfigs)
      .where(
        and(
          eq(seasonPlanningConfigs.club_id, this.clubId),
          eq(seasonPlanningConfigs.season_id, this.seasonId)
        )
      );

    if (dbConfig) {
      this.config = {
        maxNiveauSpanBeginner:
          dbConfig.max_niveau_span_beginner_months ?? DEFAULT_CONFIG.maxNiveauSpanBeginner,
        maxNiveauSpanAdvanced:
          dbConfig.max_niveau_span_advanced_months ?? DEFAULT_CONFIG.maxNiveauSpanAdvanced,
        trainerUtilizationMaxPct:
          dbConfig.trainer_utilization_max_pct ?? DEFAULT_CONFIG.trainerUtilizationMaxPct,
        groupMaxSize: dbConfig.group_max_size ?? DEFAULT_CONFIG.groupMaxSize,
        groupMinSize: dbConfig.group_min_size ?? DEFAULT_CONFIG.groupMinSize,
        provenGroupThreshold:
          dbConfig.proven_group_attendance_threshold_pct ?? DEFAULT_CONFIG.provenGroupThreshold,
        slotFailureThreshold:
          dbConfig.slot_failure_rate_threshold_pct ?? DEFAULT_CONFIG.slotFailureThreshold,
        waitlistPriorityRule:
          dbConfig.waitlist_priority_rule ?? DEFAULT_CONFIG.waitlistPriorityRule,
        preferHistoricGroups:
          dbConfig.prefer_historic_groups ?? DEFAULT_CONFIG.preferHistoricGroups,
        avoidHighFailureSlots:
          dbConfig.avoid_high_failure_slots ?? DEFAULT_CONFIG.avoidHighFailureSlots,
        kidsGroupMaxSize: dbConfig.kids_group_max_size ?? DEFAULT_CONFIG.kidsGroupMaxSize,
        kidsGroupMinSize: dbConfig.kids_group_min_size ?? DEFAULT_CONFIG.kidsGroupMinSize,
        slotDurationMinutes: dbConfig.slot_duration_minutes ?? DEFAULT_CONFIG.slotDurationMinutes,
      };
    }
  }

  private async loadMembers(): Promise<(MemberWithDetails & { _unassignedReason?: string })[]> {
    const prefs = await db
      .select({
        pref: userTrainingPreferences,
        user_name: users.full_name,
        user_email: users.email,
        user_experience: users.experience_months,
        user_skill_level: users.skill_level,
      })
      .from(userTrainingPreferences)
      .innerJoin(users, eq(userTrainingPreferences.user_id, users.id))
      .where(
        and(
          eq(userTrainingPreferences.season_id, this.seasonId),
          eq(userTrainingPreferences.is_submitted, true),
          eq(userTrainingPreferences.user_role, 'member')
        )
      );

    // Also load user_club_memberships to check is_minor / age_group info
    const memberships = await db
      .select({
        user_id: userClubMemberships.user_id,
        role: userClubMemberships.role,
      })
      .from(userClubMemberships)
      .where(
        and(eq(userClubMemberships.club_id, this.clubId), eq(userClubMemberships.is_active, true))
      );
    const membershipRoleMap = new Map<string, string>();
    for (const m of memberships) {
      membershipRoleMap.set(m.user_id, m.role);
    }

    // Load trainer feedback from previous season
    const previousSeasonId = await this.getPreviousSeasonId();
    const feedbackMap = new Map<
      string,
      { ready: boolean; level: SkillLevel | null; attendance: number | null }
    >();

    if (previousSeasonId) {
      const feedback = await db
        .select()
        .from(trainerFeedback)
        .where(eq(trainerFeedback.season_id, previousSeasonId));
      for (const fb of feedback) {
        feedbackMap.set(fb.member_id, {
          ready: fb.ready_for_next_level === 'yes',
          level: fb.recommended_level as SkillLevel | null,
          attendance: fb.attendance_quote ? Number(fb.attendance_quote) : null,
        });
      }
    }

    return prefs.map((p) => {
      const fb = feedbackMap.get(p.pref.user_id);
      const skillLevel = (p.user_skill_level || p.pref.preferred_level || 'beginner') as SkillLevel;
      const prefAgeGroup = p.pref.preferred_age_group || '';
      const isMinor = prefAgeGroup === 'kids' || membershipRoleMap.get(p.pref.user_id) === 'junior';
      return {
        id: p.pref.user_id,
        name: p.user_name || p.user_email || 'Unbekannt',
        email: p.user_email || '',
        skillLevel,
        experienceMonths: p.user_experience || 0,
        attendanceQuote: fb?.attendance ?? null,
        readyForNextLevel: fb?.ready ?? false,
        recommendedLevel: fb?.level ?? null,
        promotedLevel: null,
        availability: p.pref.weekly_availability as WeeklyAvailability,
        wishPartnerIds: (p.pref.wish_partner_ids as string[]) || [],
        avoidMemberIds: (p.pref.avoid_member_ids as string[]) || [],
        selfAssessedLevel: (p.pref.self_assessed_level as SkillLevel) || null,
        previousGroupId: null,
        isMinor,
        _unassignedReason: undefined,
      };
    });
  }

  private async loadTrainers(): Promise<TrainerWithDetails[]> {
    // 1. Get trainers who submitted preferences
    const prefs = await db
      .select({
        pref: userTrainingPreferences,
        trainer_name: users.full_name,
        trainer: trainers,
      })
      .from(userTrainingPreferences)
      .innerJoin(users, eq(userTrainingPreferences.user_id, users.id))
      .innerJoin(trainers, eq(users.id, trainers.user_id))
      .where(
        and(
          eq(userTrainingPreferences.season_id, this.seasonId),
          eq(userTrainingPreferences.is_submitted, true),
          eq(userTrainingPreferences.user_role, 'trainer')
        )
      );

    const submittedTrainerIds = new Set<string>();

    const loadedTrainers: TrainerWithDetails[] = prefs.map((p) => {
      submittedTrainerIds.add(p.trainer.id);
      return {
        id: p.trainer.id,
        name: p.trainer_name || p.trainer?.name || 'Unbekannt',
        specialties: (p.trainer?.specialties as string[]) || [],
        maxHoursPerWeek: p.trainer?.max_hours_per_week || 30,
        utilizationPct: this.config.trainerUtilizationMaxPct,
        availability: p.pref.weekly_availability as WeeklyAvailability,
        maxSessionsPerWeek: p.pref.max_sessions_per_week || 20,
        preferredCourtIds: (p.pref.preferred_court_ids as string[]) || [],
        canTeachGroups: (p.pref.can_teach_groups as string[]) || [],
        sessionsAssigned: 0,
      };
    });

    // 2. Get active trainers from the club who haven't submitted preferences
    //    These trainers get default weekday 8-22 availability so they can still
    //    be assigned by the clustering algorithm.
    const defaultAvailability = this.buildDefaultAvailability();

    const clubTrainers = await db
      .select({ trainer: trainers })
      .from(trainers)
      .innerJoin(trainerClubs, eq(trainers.id, trainerClubs.trainer_id))
      .where(and(eq(trainerClubs.club_id, this.clubId), eq(trainers.is_active, true)));

    for (const { trainer } of clubTrainers) {
      if (submittedTrainerIds.has(trainer.id)) continue;
      loadedTrainers.push({
        id: trainer.id,
        name: trainer.name || 'Unbekannt',
        specialties: (trainer.specialties as string[]) || [],
        maxHoursPerWeek: trainer.max_hours_per_week || 30,
        utilizationPct: this.config.trainerUtilizationMaxPct,
        availability: defaultAvailability,
        maxSessionsPerWeek: Math.floor((trainer.max_hours_per_week || 30) / 1.5),
        preferredCourtIds: [],
        canTeachGroups: (trainer.specialties as string[]) || [],
        sessionsAssigned: 0,
      });
    }

    return loadedTrainers;
  }

  private async loadCourts(): Promise<CourtInfo[]> {
    const courtRows = await db
      .select()
      .from(courts)
      .where(and(eq(courts.club_id, this.clubId), eq(courts.is_active, true)));
    return courtRows.map((c) => ({
      id: c.id,
      name: c.name,
      surface: c.surface,
      isActive: c.is_active,
    }));
  }

  private async loadGroups(): Promise<GroupInfo[]> {
    const groupRows = await db
      .select()
      .from(groups)
      .where(and(eq(groups.club_id, this.clubId), eq(groups.is_active, true)));
    return groupRows.map((g) => ({
      id: g.id,
      name: g.name,
      level: g.level as SkillLevel,
      ageGroup: g.age_group,
    }));
  }

  private async loadSlotFailureRates(): Promise<Record<string, number>> {
    const stats = await db
      .select()
      .from(seasonStatistics)
      .where(eq(seasonStatistics.club_id, this.clubId))
      .orderBy(asc(seasonStatistics.computed_at));

    const rates: Record<string, number> = {};
    for (const stat of stats) {
      const slotRates = stat.slot_failure_rates as Record<string, { failure_rate: number }> | null;
      if (slotRates) {
        for (const [key, val] of Object.entries(slotRates)) {
          if (!rates[key] || val.failure_rate > rates[key]) {
            rates[key] = val.failure_rate;
          }
        }
      }
    }
    return rates;
  }

  private async loadHistoricGroups(): Promise<
    Map<string, { groupId: string; attendance: number; members: string[] }>
  > {
    const previousSeasonId = await this.getPreviousSeasonId();
    if (!previousSeasonId) return new Map();

    const entries = await db
      .select()
      .from(seasonPlanEntries)
      .where(eq(seasonPlanEntries.season_id, previousSeasonId));

    const feedback = await db
      .select()
      .from(trainerFeedback)
      .where(eq(trainerFeedback.season_id, previousSeasonId));

    // Group attendance by group
    const groupAttendance = new Map<string, number[]>();
    for (const fb of feedback) {
      if (fb.group_id && fb.attendance_quote) {
        const arr = groupAttendance.get(fb.group_id) || [];
        arr.push(Number(fb.attendance_quote));
        groupAttendance.set(fb.group_id, arr);
      }
    }

    const result = new Map<string, { groupId: string; attendance: number; members: string[] }>();

    for (const entry of entries) {
      if (!entry.group_id) continue;
      const atts = groupAttendance.get(entry.group_id) || [];
      const avgAttendance = atts.length > 0 ? atts.reduce((a, b) => a + b, 0) / atts.length : 0;

      if (avgAttendance >= this.config.provenGroupThreshold) {
        const key = `${entry.day_of_week}_${entry.start_time}`;
        result.set(key, {
          groupId: entry.group_id,
          attendance: avgAttendance,
          members: (entry.expected_participants as string[]) || [],
        });
      }
    }

    return result;
  }

  private async getPreviousSeasonId(): Promise<string | null> {
    const [currentSeason] = await db.select().from(seasons).where(eq(seasons.id, this.seasonId));

    if (!currentSeason) return null;

    const previousSeasons = await db
      .select()
      .from(seasons)
      .where(
        and(eq(seasons.club_id, this.clubId), eq(seasons.season_type, currentSeason.season_type))
      )
      .orderBy(asc(seasons.year));

    // Find the season just before current one
    const idx = previousSeasons.findIndex((s) => s.id === this.seasonId);
    if (idx <= 0) return null;
    return previousSeasons[idx - 1].id;
  }

  // ============================================
  // NIVEAU PROMOTIONS (Schritt 4c)
  // ============================================

  private applyNiveauPromotions(
    members: (MemberWithDetails & { _unassignedReason?: string })[]
  ): void {
    for (const member of members) {
      if (member.readyForNextLevel) {
        member.promotedLevel = NEXT_LEVEL[member.skillLevel];
        member._unassignedReason = undefined;
      }
    }
  }

  // ============================================
  // CANDIDATE GROUP BUILDING
  // ============================================

  private buildCandidateGroups(
    _members: (MemberWithDetails & { _unassignedReason?: string })[],
    _trainers: TrainerWithDetails[],
    groups: GroupInfo[],
    historicGroups: Map<string, { groupId: string; attendance: number; members: string[] }>
  ): Map<string, GroupInfo> {
    const candidates = new Map<string, GroupInfo>();

    // Start with existing groups
    for (const g of groups) {
      candidates.set(g.id, g);
    }

    // Add historic proven groups as candidates
    if (this.config.preferHistoricGroups) {
      for (const [, historic] of historicGroups) {
        const existing = groups.find((g) => g.id === historic.groupId);
        if (existing && !candidates.has(existing.id)) {
          candidates.set(existing.id, existing);
        }
      }
    }

    return candidates;
  }

  // ============================================
  // GREEDY CLUSTERING (Schritt 4a + 4b)
  // ============================================

  private async greedyCluster(
    members: (MemberWithDetails & { _unassignedReason?: string })[],
    trainers: TrainerWithDetails[],
    courts: CourtInfo[],
    candidateGroups: Map<string, GroupInfo>,
    slotFailureRates: Record<string, number>,
    timeSlots: Array<{ start: string; end: string }>
  ): Promise<{
    assignments: GroupAssignment[];
    unassigned: (MemberWithDetails & { _unassignedReason?: string })[];
  }> {
    const assignments: GroupAssignment[] = [];
    const assignedMemberIds = new Set<string>();
    const trainerSessionCount = new Map<string, number>();
    const courtTimeSlotUsage = new Map<string, Set<string>>(); // courtId -> "day_start" keys

    // Initialize trainer counts
    for (const t of trainers) {
      trainerSessionCount.set(t.id, 0);
    }

    // Sort members: priority to waitlist-carryovers, then high attendance, then by experience
    const sortedMembers = [...members].sort((a, b) => {
      // Priorität 1: Wartelisten-Mitglieder aus Vorsaison
      const aWait = a.attendanceQuote === null ? 1 : 0; // null means was waitlisted
      const bWait = b.attendanceQuote === null ? 1 : 0;
      if (aWait !== bWait) return bWait - aWait;

      // Priorität 2: Höhere Anwesenheitsquote
      const aAtt = a.attendanceQuote || 0;
      const bAtt = b.attendanceQuote || 0;
      if (Math.abs(aAtt - bAtt) > 5) return bAtt - aAtt;

      // Priorität 3: Erfahrung (erfahrenere zuerst)
      return b.experienceMonths - a.experienceMonths;
    });

    // Split members into kids and adults, then by skill level
    const kids = sortedMembers.filter((m) => m.isMinor);
    const adults = sortedMembers.filter((m) => !m.isMinor);

    // Assign kids first (usually smaller groups, more attention needed)
    let _groupIndex = await this.assignMembersToGroups(
      kids,
      'kids',
      trainers,
      courts,
      candidateGroups,
      slotFailureRates,
      timeSlots,
      trainerSessionCount,
      courtTimeSlotUsage,
      assignments,
      assignedMemberIds,
      0
    );

    // Then assign adults
    _groupIndex = await this.assignMembersToGroups(
      adults,
      'adult',
      trainers,
      courts,
      candidateGroups,
      slotFailureRates,
      timeSlots,
      trainerSessionCount,
      courtTimeSlotUsage,
      assignments,
      assignedMemberIds,
      _groupIndex
    );

    // SECOND PASS: try to place unassigned members (e.g. avoid-conflict victims)
    // into groups that have remaining capacity, matching level/age-group, and no avoid-conflicts.
    // NOTE: This is best-effort — it does NOT verify time-slot availability per member,
    //       so a member could be assigned to a time they can't attend. Admins should
    //       review second-pass placements in the plan-edit step.
    const stillUnassigned = sortedMembers.filter((m) => !assignedMemberIds.has(m.id));
    if (stillUnassigned.length > 0) {
      for (const member of stillUnassigned) {
        const effectiveLevel = member.promotedLevel || member.skillLevel;
        const memberAgeGroup = member.isMinor ? 'kids' : 'adult';
        const maxSize = member.isMinor ? this.config.kidsGroupMaxSize : this.config.groupMaxSize;

        // Try to find an existing group with space, matching level/age, and no avoid-conflicts
        let placed = false;
        for (const assignment of assignments) {
          // Capacity check
          if (assignment.memberIds.length >= maxSize) continue;

          // Level compatibility: must match the group's level
          const groupInfo = candidateGroups.get(assignment.groupId);
          if (groupInfo && groupInfo.level !== effectiveLevel) continue;

          // Age-group compatibility: must match the group's age group
          if (groupInfo && groupInfo.ageGroup && groupInfo.ageGroup !== memberAgeGroup) continue;

          // Avoid conflicts: member avoids any existing group member
          if (member.avoidMemberIds.length > 0) {
            const hasConflict = assignment.memberIds.some((mid) =>
              member.avoidMemberIds.includes(mid)
            );
            if (hasConflict) continue;
          }

          // Avoid conflicts: any existing group member avoids this member
          const groupMemberAvoids = sortedMembers.filter(
            (m) => assignment.memberIds.includes(m.id) && m.avoidMemberIds.includes(member.id)
          );
          if (groupMemberAvoids.length > 0) continue;

          // Place member in this group
          assignment.memberIds.push(member.id);
          assignment.memberDetails.push({
            memberId: member.id,
            memberName: member.name,
            niveauMatch: -1, // -1 = not computed (second-pass placement)
            experienceMonths: member.experienceMonths,
            groupExperienceSpan: '—',
            wishPartnerFulfilled: false,
            wishPartnerNames: [],
            isPromoted: !!member.promotedLevel,
            assignmentReason: 'Nachträglich zugewiesen (zweite Runde)',
          });
          assignedMemberIds.add(member.id);
          member._unassignedReason = undefined;
          placed = true;
          break;
        }

        if (!placed) {
          member._unassignedReason =
            member._unassignedReason ||
            `Keine passende Gruppe mit Kapazität gefunden (${memberAgeGroup}, ${effectiveLevel})`;
        }
      }
    }

    const unassigned = sortedMembers.filter((m) => !assignedMemberIds.has(m.id));
    return { assignments, unassigned };
  }

  /**
   * Assign a cohort (kids or adults) to groups by skill level.
   * Kids use kidsGroupMaxSize/kidsGroupMinSize; adults use groupMaxSize/groupMinSize.
   * Avoid-member pairs are checked before placing members together.
   * Returns the updated groupIndex after all assignments.
   */
  private async assignMembersToGroups(
    cohort: (MemberWithDetails & { _unassignedReason?: string })[],
    ageGroup: 'kids' | 'adult',
    trainers: TrainerWithDetails[],
    courts: CourtInfo[],
    candidateGroups: Map<string, GroupInfo>,
    slotFailureRates: Record<string, number>,
    timeSlots: Array<{ start: string; end: string }>,
    trainerSessionCount: Map<string, number>,
    courtTimeSlotUsage: Map<string, Set<string>>,
    assignments: GroupAssignment[],
    assignedMemberIds: Set<string>,
    startGroupIndex: number
  ): Promise<number> {
    const maxSize = ageGroup === 'kids' ? this.config.kidsGroupMaxSize : this.config.groupMaxSize;
    const minSize = ageGroup === 'kids' ? this.config.kidsGroupMinSize : this.config.groupMinSize;

    // Group members by effective level (promoted or original)
    const levelGroups = new Map<SkillLevel, typeof cohort>();
    for (const skill of ['beginner', 'intermediate', 'advanced', 'professional'] as SkillLevel[]) {
      levelGroups.set(skill, []);
    }
    for (const m of cohort) {
      const effectiveLevel = m.promotedLevel || m.skillLevel;
      levelGroups.get(effectiveLevel)?.push(m);
    }

    let groupIndex = startGroupIndex;

    for (const [skillLevel, levelMembers] of levelGroups) {
      if (levelMembers.length === 0) continue;

      const matchingGroups = Array.from(candidateGroups.values()).filter(
        (g) => g.level === skillLevel && g.ageGroup === ageGroup
      );

      // If no age-specific groups found, allow any matching level group
      const allMatching =
        matchingGroups.length > 0
          ? matchingGroups
          : Array.from(candidateGroups.values()).filter((g) => g.level === skillLevel);

      // Build avoid-member map for this cohort
      const avoidMap = new Map<string, Set<string>>();
      for (const m of levelMembers) {
        if (m.avoidMemberIds.length > 0) {
          avoidMap.set(m.id, new Set(m.avoidMemberIds));
        }
      }

      const numGroups = Math.ceil(levelMembers.length / maxSize);

      for (let i = 0; i < numGroups; i++) {
        const slice = levelMembers.slice(i * maxSize, (i + 1) * maxSize);

        // Filter out avoid-member conflicts from this slice
        const filteredSlice = slice.filter((m) => {
          const enemies = avoidMap.get(m.id);
          if (!enemies || enemies.size === 0) return true;
          // Check if any member in this slice is on m's avoid list
          return !slice.some((other) => other.id !== m.id && enemies.has(other.id));
        });

        if (filteredSlice.length < minSize && numGroups > 1) {
          // Mark avoid-conflicted members for later retry
          for (const m of slice) {
            if (!filteredSlice.includes(m) && !assignedMemberIds.has(m.id)) {
              if (!m._unassignedReason) {
                m._unassignedReason = `Avoid-Konflikt in ${skillLevel} (${ageGroup}) — wird in zweiter Runde neu zugewiesen`;
              }
            }
          }
          continue;
        }

        // Find best time slot
        const bestSlot = this.findBestTimeSlot(
          filteredSlice,
          trainers,
          courts,
          trainerSessionCount,
          courtTimeSlotUsage,
          slotFailureRates,
          assignments,
          timeSlots
        );

        if (!bestSlot) {
          // No slot found — mark all for retry (will be picked up in second pass or remain unassigned)
          for (const m of filteredSlice) {
            if (!assignedMemberIds.has(m.id)) {
              m._unassignedReason = `Kein verfügbarer Zeitslot mit Trainer für Level ${skillLevel} (${ageGroup})`;
            }
          }
          continue;
        }

        // Select matching group or create placeholder in DB
        const existingGroup = allMatching[groupIndex % Math.max(1, allMatching.length)];
        let group: GroupInfo;
        if (existingGroup) {
          group = existingGroup;
        } else {
          const prefix =
            ageGroup === 'kids' ? 'Kids' : skillLevel.charAt(0).toUpperCase() + skillLevel.slice(1);
          const groupName = `${prefix} Gruppe ${groupIndex + 1}`;
          const [newGroup] = await db
            .insert(groups)
            .values({
              club_id: this.clubId,
              name: groupName,
              level: skillLevel,
              age_group: ageGroup === 'kids' ? 'kids' : 'adult',
              is_active: true,
              member_ids: [],
            })
            .returning({
              id: groups.id,
              name: groups.name,
              level: groups.level,
              age_group: groups.age_group,
            });
          group = {
            id: newGroup.id,
            name: newGroup.name,
            level: newGroup.level as SkillLevel,
            ageGroup: newGroup.age_group,
          };
        }

        groupIndex++;

        // Calculate niveau spans
        const experiences = filteredSlice.map((m) => m.experienceMonths);
        const minExp = Math.min(...experiences);
        const maxExp = Math.max(...experiences);
        const span = maxExp - minExp;
        const maxAllowedSpan =
          skillLevel === 'beginner'
            ? this.config.maxNiveauSpanBeginner
            : this.config.maxNiveauSpanAdvanced;

        const warnings: string[] = [];
        if (span > maxAllowedSpan) {
          warnings.push(
            `Niveau-Spanne (${minExp}-${maxExp} Monate) überschreitet Maximum (${maxAllowedSpan})`
          );
        }

        if (bestSlot.failureWarning) {
          warnings.push(
            `Zeitslot hat ${((bestSlot.failureRate || 0) * 100).toFixed(0)}% historische Ausfallrate`
          );
        }

        if (filteredSlice.length < minSize) {
          warnings.push(`Gruppe hat nur ${filteredSlice.length} Mitglieder (Minimum: ${minSize})`);
        }

        // Warn about avoid conflicts that were filtered out
        const removedCount = slice.length - filteredSlice.length;
        if (removedCount > 0) {
          warnings.push(
            `${removedCount} Mitglieder wegen Avoid-Konflikten aus dieser Gruppe entfernt`
          );
        }

        // Track trainer session
        const currentCount = trainerSessionCount.get(bestSlot.trainerId) || 0;
        trainerSessionCount.set(bestSlot.trainerId, currentCount + 1);

        // Track court usage
        const courtKey = `${bestSlot.dayOfWeek}_${bestSlot.startTime}`;
        const courtUsage = courtTimeSlotUsage.get(bestSlot.courtId || '') || new Set();
        courtUsage.add(courtKey);
        courtTimeSlotUsage.set(bestSlot.courtId || '', courtUsage);

        // Build member details with wish partner tracking
        const memberDetails = filteredSlice.map((m) => {
          const fulfilledWishes = m.wishPartnerIds.filter((wpid) =>
            filteredSlice.some((sm) => sm.id === wpid)
          );
          const niveauMatch = this.computeNiveauMatch(m, filteredSlice);
          const reason = this.buildAssignmentReason(m, bestSlot!, fulfilledWishes);

          return {
            memberId: m.id,
            memberName: m.name,
            niveauMatch,
            experienceMonths: m.experienceMonths,
            groupExperienceSpan: `${minExp}-${maxExp} Monate`,
            wishPartnerFulfilled: fulfilledWishes.length > 0,
            wishPartnerNames: fulfilledWishes.map(
              (wpid) => filteredSlice.find((sm) => sm.id === wpid)?.name || 'Unbekannt'
            ),
            isPromoted: !!m.promotedLevel,
            assignmentReason: reason,
          };
        });

        assignments.push({
          groupId: group.id,
          groupName: group.name,
          trainerId: bestSlot.trainerId,
          trainerName: bestSlot.trainerName,
          dayOfWeek: bestSlot.dayOfWeek,
          startTime: bestSlot.startTime,
          endTime: bestSlot.endTime,
          courtId: bestSlot.courtId,
          courtName: bestSlot.courtName,
          memberIds: filteredSlice.map((m) => m.id),
          memberDetails,
          waitlistIds: [],
          waitlistDetails: [],
          warnings,
          conflictIds: [],
        });

        for (const m of filteredSlice) {
          assignedMemberIds.add(m.id);
        }
      }
    }

    return groupIndex;
  }

  private findBestTimeSlot(
    members: (MemberWithDetails & { _unassignedReason?: string })[],
    trainers: TrainerWithDetails[],
    courts: CourtInfo[],
    trainerSessionCount: Map<string, number>,
    courtTimeSlotUsage: Map<string, Set<string>>,
    slotFailureRates: Record<string, number>,
    existingAssignments: GroupAssignment[],
    timeSlots: Array<{ start: string; end: string }>
  ):
    | (TimeSlotInfo & {
        trainerId: string;
        trainerName: string;
        courtId: string | null;
        courtName: string | null;
      })
    | null {
    let bestScore = -Infinity;
    let bestResult:
      | (TimeSlotInfo & {
          trainerId: string;
          trainerName: string;
          courtId: string | null;
          courtName: string | null;
        })
      | null = null;

    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const dayName = DAY_NAMES[dayOfWeek];

      for (const timeSlot of timeSlots) {
        // HARD CONSTRAINT: Check member availability
        const availableMembers = members.filter((m) => {
          const daySlots = m.availability[dayName] || [];
          return daySlots.some((slot) => slot.start <= timeSlot.start && slot.end >= timeSlot.end);
        });

        if (availableMembers.length < Math.max(1, this.config.groupMinSize)) continue;

        // HARD CONSTRAINT: Find available trainer
        let bestTrainer: TrainerWithDetails | null = null;
        let bestTrainerScore = -Infinity;

        for (const trainer of trainers) {
          // Check availability
          const daySlots = trainer.availability[dayName] || [];
          const isAvailable = daySlots.some(
            (slot) => slot.start <= timeSlot.start && slot.end >= timeSlot.end
          );
          if (!isAvailable) continue;

          // Check max sessions
          const currentSessions = trainerSessionCount.get(trainer.id) || 0;
          if (currentSessions >= trainer.maxSessionsPerWeek) continue;

          // Check hours limit
          const hoursAssigned = currentSessions * 1.5; // 90 min sessions
          const maxHours = trainer.maxHoursPerWeek * (trainer.utilizationPct / 100);
          if (hoursAssigned + 1.5 > maxHours) continue;

          // Check trainer not already assigned to same day+time
          const isDoubleBooked = existingAssignments.some(
            (a) =>
              a.trainerId === trainer.id &&
              a.dayOfWeek === dayOfWeek &&
              this.timeSlotsOverlap(a.startTime, a.endTime, timeSlot.start, timeSlot.end)
          );
          if (isDoubleBooked) continue;

          // Score trainer: specialization match + availability match
          let score = 0;
          const memberLevels = new Set(
            availableMembers.map((m) => m.promotedLevel || m.skillLevel)
          );
          for (const level of memberLevels) {
            if (trainer.specialties.includes(level)) score += 20;
          }
          score += (trainer.maxSessionsPerWeek - currentSessions) * 5; // prefer less busy
          score += trainer.canTeachGroups.length > 0 ? 10 : 0;

          if (score > bestTrainerScore) {
            bestTrainerScore = score;
            bestTrainer = trainer;
          }
        }

        if (!bestTrainer) continue;

        // HARD CONSTRAINT: Find available court
        const courtKey = `${dayOfWeek}_${timeSlot.start}`;
        let selectedCourt: CourtInfo | null = null;

        for (const court of courts) {
          const usage = courtTimeSlotUsage.get(court.id) || new Set();
          if (!usage.has(courtKey)) {
            // Check existing assignments for this court
            const isTaken = existingAssignments.some(
              (a) =>
                a.courtId === court.id &&
                a.dayOfWeek === dayOfWeek &&
                this.timeSlotsOverlap(a.startTime, a.endTime, timeSlot.start, timeSlot.end)
            );
            if (!isTaken) {
              selectedCourt = court;
              break;
            }
          }
        }

        // Court is optional (can be null if no courts configured)

        // Check slot failure rate (soft constraint)
        const slotKey = `${dayOfWeek}_${timeSlot.start}`;
        const failureRate = slotFailureRates[slotKey] || null;
        const failureWarning =
          failureRate !== null && failureRate >= this.config.slotFailureThreshold / 100;

        let score = 0;
        score += availableMembers.length * 10; // prefer fuller groups
        score -= failureWarning && this.config.avoidHighFailureSlots ? 50 : 0;
        // Prefer weekdays over weekends
        score -= dayOfWeek >= 5 ? 15 : 0;

        if (score > bestScore) {
          bestScore = score;
          bestResult = {
            dayOfWeek: dayOfWeek as DayOfWeek,
            startTime: timeSlot.start,
            endTime: timeSlot.end,
            failureRate,
            failureWarning,
            trainerId: bestTrainer.id,
            trainerName: bestTrainer.name,
            courtId: selectedCourt?.id || null,
            courtName: selectedCourt?.name || null,
          };
        }
      }
    }

    return bestResult;
  }

  /**
   * Build default weekday availability (Mon-Fri 08:00-22:00) for trainers
   * who haven't submitted explicit preferences. This ensures they can still
   * be assigned to time slots by the clustering algorithm.
   */
  private buildDefaultAvailability(): WeeklyAvailability {
    const defaultSlot = { start: '08:00', end: '22:00' };
    return {
      monday: [defaultSlot],
      tuesday: [defaultSlot],
      wednesday: [defaultSlot],
      thursday: [defaultSlot],
      friday: [defaultSlot],
      saturday: [],
      sunday: [],
    };
  }

  private timeSlotsOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
    return start1 < end2 && start2 < end1;
  }

  // ============================================
  // WAITLIST LOGIC (Schritt 4d)
  // ============================================

  private applyWaitlistLogic(
    assignments: GroupAssignment[],
    members: (MemberWithDetails & { _unassignedReason?: string })[],
    _groups: GroupInfo[]
  ): {
    waitlisted: Array<{ memberId: string; groupId: string; position: number }>;
    summary: ClusteringResult['waitlistSummary'];
  } {
    const waitlisted: Array<{ memberId: string; groupId: string; position: number }> = [];
    const summary: ClusteringResult['waitlistSummary'] = [];

    // For each member's wish partners not in the same group:
    // If a member wanted to be in a specific group but it's full, put them on waitlist
    for (const assignment of assignments) {
      const groupMembers = new Set(assignment.memberIds);

      for (const detail of assignment.memberDetails) {
        const member = members.find((m) => m.id === detail.memberId);
        if (!member || member.wishPartnerIds.length === 0) continue;

        for (const wpid of member.wishPartnerIds) {
          if (groupMembers.has(wpid)) continue; // already together

          // Find which group the wish partner is in
          const partnerAssignment = assignments.find((a) => a.memberIds.includes(wpid));
          if (!partnerAssignment) continue;

          // Check if there's space in partner's group
          if (
            partnerAssignment.memberIds.length + partnerAssignment.waitlistIds.length >=
            this.config.groupMaxSize
          ) {
            const position = partnerAssignment.waitlistIds.length + 1;
            partnerAssignment.waitlistIds.push(member.id);
            partnerAssignment.waitlistDetails.push({
              memberId: member.id,
              memberName: member.name,
              position,
            });

            waitlisted.push({
              memberId: member.id,
              groupId: partnerAssignment.groupId,
              position,
            });

            summary.push({
              memberId: member.id,
              memberName: member.name,
              groupName: partnerAssignment.groupName,
              position,
              alternativeGroupName: assignment.groupName,
            });
          }
        }
      }
    }

    return { waitlisted, summary };
  }

  // ============================================
  // METRICS
  // ============================================

  private computeMetrics(
    members: (MemberWithDetails & { _unassignedReason?: string })[],
    trainers: TrainerWithDetails[],
    assignments: GroupAssignment[],
    _unassigned: (MemberWithDetails & { _unassignedReason?: string })[],
    waitlisted: Array<{ memberId: string; groupId: string; position: number }>
  ): ClusteringMetrics {
    const totalMembers = members.length;
    const totalGroups = assignments.length;
    const totalTrainers = new Set(assignments.map((a) => a.trainerId)).size;

    // Niveau match
    const allMatches = assignments.flatMap((a) => a.memberDetails.map((d) => d.niveauMatch));
    const avgNiveauMatch =
      allMatches.length > 0 ? allMatches.reduce((a, b) => a + b, 0) / allMatches.length : 0;
    const niveauSpanViolations = assignments.filter((a) =>
      a.warnings.some((w) => w.includes('Niveau-Spanne'))
    ).length;

    // Wish partners
    const wishPartnerRequests = members.reduce((sum, m) => sum + m.wishPartnerIds.length, 0);
    const wishPartnerFulfilled = assignments.reduce(
      (sum, a) => sum + a.memberDetails.filter((d) => d.wishPartnerFulfilled).length,
      0
    );
    const wishPartnerRate =
      wishPartnerRequests > 0 ? (wishPartnerFulfilled / wishPartnerRequests) * 100 : 0;

    // Trainer load
    const trainerLoads = assignments.reduce(
      (acc, a) => {
        acc[a.trainerId] = (acc[a.trainerId] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const trainerUtils = Object.entries(trainerLoads).map(([tid, sessions]) => {
      const trainer = trainers.find((t) => t.id === tid);
      const maxSess = trainer?.maxSessionsPerWeek || 20;
      return (sessions / maxSess) * 100;
    });
    const avgTrainerUtilization =
      trainerUtils.length > 0 ? trainerUtils.reduce((a, b) => a + b, 0) / trainerUtils.length : 0;
    const trainerOverloadWarnings = trainerUtils.filter(
      (u) => u > this.config.trainerUtilizationMaxPct
    ).length;

    // Slot risk
    const highRiskSlotsUsed = assignments.filter((a) =>
      a.warnings.some((w) => w.includes('Ausfallrate'))
    ).length;

    // Waitlist
    const totalWaitlisted = waitlisted.length;

    return {
      totalMembers,
      totalGroups,
      totalTrainers,
      avgNiveauMatch: Math.round(avgNiveauMatch * 100) / 100,
      niveauSpanViolations,
      wishPartnerRequests,
      wishPartnerFulfilled,
      wishPartnerRate: Math.round(wishPartnerRate * 100) / 100,
      avgTrainerUtilization: Math.round(avgTrainerUtilization * 100) / 100,
      trainerOverloadWarnings,
      highRiskSlotsUsed,
      totalWaitlisted,
      runtimeMs: Date.now() - this.startTime,
      iterations: assignments.length,
    };
  }

  // ============================================
  // HELPERS
  // ============================================

  private computeNiveauMatch(
    member: MemberWithDetails & { _unassignedReason?: string },
    group: (MemberWithDetails & { _unassignedReason?: string })[]
  ): number {
    const experiences = group.map((m) => m.experienceMonths);
    const avg = experiences.reduce((a, b) => a + b, 0) / experiences.length;
    const maxSpan = Math.max(...experiences) - Math.min(...experiences);

    if (maxSpan === 0) return 100;

    // How close is this member to the group average?
    const distance = Math.abs(member.experienceMonths - avg);
    const normalizedDistance = maxSpan > 0 ? distance / (maxSpan / 2) : 0;

    return Math.max(0, Math.min(100, Math.round((1 - normalizedDistance) * 100)));
  }

  private buildAssignmentReason(
    member: MemberWithDetails & { _unassignedReason?: string },
    _slot: TimeSlotInfo & { trainerId: string; trainerName: string },
    fulfilledWishes: string[]
  ): string {
    const parts: string[] = [];
    parts.push(`Verfügbarkeit passt`);

    if (member.promotedLevel) {
      parts.push(
        `Höherstufung: ${member.skillLevel} → ${member.promotedLevel} (Trainer-Empfehlung)`
      );
    }

    if (fulfilledWishes.length > 0) {
      parts.push(`Wunschpartner: ${fulfilledWishes.join(', ')} ✓`);
    }

    return parts.join(' · ');
  }

  private generateExplanations(
    assignments: GroupAssignment[],
    members: (MemberWithDetails & { _unassignedReason?: string })[],
    trainers: TrainerWithDetails[]
  ): string[] {
    const explanations: string[] = [];

    explanations.push(
      `Clustering abgeschlossen: ${assignments.length} Gruppen mit ${members.length} Mitgliedern`
    );

    const promoted = members.filter((m) => m.promotedLevel);
    if (promoted.length > 0) {
      explanations.push(
        `${promoted.length} Mitglieder wurden basierend auf Trainer-Feedback der Vorsaison höhergestuft`
      );
    }

    const trainerCounts = assignments.reduce(
      (acc, a) => {
        acc[a.trainerId] = (acc[a.trainerId] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    for (const [tid, count] of Object.entries(trainerCounts)) {
      const trainer = trainers.find((t) => t.id === tid);
      if (trainer) {
        const hours = count * 1.5;
        const max = trainer.maxHoursPerWeek * (trainer.utilizationPct / 100);
        explanations.push(`Trainer ${trainer.name}: ${count} Sessions (${hours}h von max ${max}h)`);
      }
    }

    const withWarnings = assignments.filter((a) => a.warnings.length > 0);
    if (withWarnings.length > 0) {
      explanations.push(
        `${withWarnings.length} Gruppen haben Hinweise (Niveau-Spannen, Ausfallraten o.ä.)`
      );
    }

    return explanations;
  }

  // ============================================
  // DATABASE PERSISTENCE
  // ============================================

  private async saveToDatabase(result: ClusteringResult): Promise<void> {
    // Delete existing plan entries for this season (re-planning)
    await db.delete(seasonPlanEntries).where(eq(seasonPlanEntries.season_id, this.seasonId));

    // Delete existing waitlists
    await db.delete(seasonWaitlists).where(eq(seasonWaitlists.season_id, this.seasonId));

    // Insert new plan entries
    const entriesToInsert = result.groups.map((g) => ({
      season_id: this.seasonId,
      club_id: this.clubId,
      trainer_id: g.trainerId,
      court_id: g.courtId,
      group_id: g.groupId,
      day_of_week: g.dayOfWeek,
      start_time: `${g.startTime}:00`,
      end_time: `${g.endTime}:00`,
      duration_minutes:
        (parseInt(g.endTime.split(':')[0]) - parseInt(g.startTime.split(':')[0])) * 60 +
        (parseInt(g.endTime.split(':')[1]) - parseInt(g.startTime.split(':')[1])),
      starts_from_week: 1,
      entry_type: 'training',
      planning_source: 'auto',
      max_participants: this.config.groupMaxSize,
      expected_participants: g.memberIds,
      preference_match_score: String(
        g.memberDetails.reduce((sum, d) => sum + d.niveauMatch, 0) /
          Math.max(1, g.memberDetails.length)
      ),
      optimization_score: '0',
      conflict_score: String(g.warnings.length * 10),
      status: 'planned',
    }));

    if (entriesToInsert.length > 0) {
      await db.insert(seasonPlanEntries).values(entriesToInsert as any);
    }

    // Insert waitlist entries
    const waitlistToInsert = result.waitlistSummary.map((w) => ({
      season_id: this.seasonId,
      club_id: this.clubId,
      group_id: result.groups.find((g) => g.groupName === w.groupName)?.groupId || '',
      member_id: w.memberId,
      position: w.position,
      priority: 5,
      priority_reason: this.config.waitlistPriorityRule,
      status: 'waiting' as const,
      alternative_group_id: w.alternativeGroupName
        ? result.groups.find((g) => g.groupName === w.alternativeGroupName)?.groupId || null
        : null,
    }));

    if (waitlistToInsert.length > 0) {
      await db.insert(seasonWaitlists).values(waitlistToInsert as any);
    }

    // Update season status
    await db
      .update(seasons)
      .set({
        planning_status: 'manual_review',
        last_planned_at: new Date(),
      })
      .where(eq(seasons.id, this.seasonId));
  }
}

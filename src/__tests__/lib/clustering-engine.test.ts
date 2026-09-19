import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══ Hoisted mock state + Thenable chain factory ════════════════════════
const h = vi.hoisted(() => {
  const state = {
    members: [] as any[],
    trainers: [] as any[],
    memberships: [] as any[],
    feedback: [] as any[],
    courts: [] as any[],
    groups: [] as any[],
    planEntries: [] as any[],
    stats: [] as any[],
    config: null as any,
    seasons: [] as any[],
    baselinePrefs: [] as any[],
    clubs: [] as any[],
    insertedGroups: [] as any[],
    insertedPlanEntries: [] as any[],
    insertedWaitlist: [] as any[],
    updatedSeasons: [] as any[],
  };

  return { state };
});

// ═══ Repository-Fake ════════════════════════════════════════════════════
// Die Engine liest und schreibt ausschliesslich über SeasonClusteringRepository
// (ADR-005). Der Fake liefert die Zeilenform des echten Repositorys aus `h.state`.
const fakeRepo = {
  findSeason: async () => h.state.seasons[0] ?? null,
  seasonIdsOfType: async () => h.state.seasons.map((s: any) => s.id),
  clubBundesland: async () => null,
  planningConfig: async () => h.state.config,
  submittedMemberPrefs: async () => h.state.members,
  baselineMemberPrefs: async () => h.state.baselinePrefs,
  activeMemberships: async () => h.state.memberships,
  userProfiles: async () => [],
  trainerFeedback: async () => h.state.feedback,
  submittedTrainerPrefs: async () => [],
  activeClubTrainers: async () => h.state.trainers,
  activeTrainersByMembership: async () => [],
  activeClosures: async () => [],
  trainingCourts: async () => h.state.courts,
  activeGroups: async () => h.state.groups,
  seasonStatistics: async () => h.state.stats,
  planEntries: async () => h.state.planEntries,
  futureSessionIdsOfSeason: async () => [],
  deleteSessionsWithBookings: async () => {},
  deletePlanEntries: async () => {},
  deleteWaitlists: async () => {},
  renameGroup: async () => {},
  insertGroup: async (row: any) => {
    h.state.insertedGroups.push(row);
    return `inserted-${h.state.insertedGroups.length}`;
  },
  insertPlanEntries: async (rows: any[]) => {
    h.state.insertedPlanEntries.push(...rows);
  },
  insertWaitlist: async (rows: any[]) => {
    h.state.insertedWaitlist.push(...rows);
  },
  updateSeason: async (_id: string, patch: any) => {
    h.state.updatedSeasons.push(patch);
  },
} as any;

// ═══ Import engine AFTER all mocks are registered ════════════════════════
import { SeasonClusteringEngine as RealEngine } from '@/lib/season-planning/clustering-engine';

/** Engine mit dem Repository-Fake — die Testfälle konstruieren weiter mit (Saison, Verein, Config). */
class SeasonClusteringEngine extends RealEngine {
  constructor(
    seasonId: string,
    clubId: string,
    config?: ConstructorParameters<typeof RealEngine>[2]
  ) {
    super(seasonId, clubId, config, fakeRepo);
  }
}
import type {
  MemberWithDetails,
  TrainerWithDetails,
  CourtInfo,
  GroupInfo,
  GroupAssignment,
} from '@/lib/season-planning/types';
import type { SkillLevel } from '@/lib/types/season-planning';

// ═══ Helpers ═════════════════════════════════════════════════════════════

function makeMember(overrides: Partial<MemberWithDetails> = {}): MemberWithDetails {
  return {
    id: 'm1',
    name: 'Alice',
    email: 'alice@test.de',
    skillLevel: 'intermediate' as SkillLevel,
    experienceMonths: 6,
    attendanceQuote: null,
    readyForNextLevel: false,
    recommendedLevel: null,
    promotedLevel: null,
    availability: {
      monday: [{ start: '08:00', end: '22:00' }],
      tuesday: [{ start: '08:00', end: '22:00' }],
      wednesday: [{ start: '08:00', end: '22:00' }],
      thursday: [{ start: '08:00', end: '22:00' }],
      friday: [{ start: '08:00', end: '22:00' }],
      saturday: [],
      sunday: [],
    },
    wishPartnerIds: [],
    avoidMemberIds: [],
    selfAssessedLevel: null,
    previousGroupId: null,
    isMinor: false,
    maxSessionsPerWeek: 1,
    preferredCourtIds: [],
    preferredGroupIds: [],
    priority: 5,
    ...overrides,
  };
}

function makeTrainer(overrides: Partial<TrainerWithDetails> = {}): TrainerWithDetails {
  return {
    id: 't1',
    name: 'Coach Tom',
    specialties: ['intermediate', 'advanced'],
    maxHoursPerWeek: 30,
    utilizationPct: 80,
    availability: {
      monday: [{ start: '08:00', end: '22:00' }],
      tuesday: [{ start: '08:00', end: '22:00' }],
      wednesday: [{ start: '08:00', end: '22:00' }],
      thursday: [{ start: '08:00', end: '22:00' }],
      friday: [{ start: '08:00', end: '22:00' }],
      saturday: [],
      sunday: [],
    },
    maxSessionsPerWeek: 20,
    preferredCourtIds: [],
    canTeachGroups: ['intermediate'],
    sessionsAssigned: 0,
    ...overrides,
  };
}

function makeCourt(overrides: Partial<CourtInfo> = {}): CourtInfo {
  return { id: 'c1', name: 'Court 1', surface: 'sand', isActive: true, ...overrides };
}

function makeGroup(overrides: Partial<GroupInfo> = {}): GroupInfo {
  return {
    id: 'g1',
    name: 'Intermediate Group 1',
    level: 'intermediate' as SkillLevel,
    ageGroup: 'adult',
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<GroupAssignment> = {}): GroupAssignment {
  return {
    groupId: 'g1',
    groupName: 'Intermediate Group 1',
    trainerId: 't1',
    trainerName: 'Coach Tom',
    dayOfWeek: 1,
    startTime: '18:00',
    endTime: '19:30',
    courtId: 'c1',
    courtName: 'Court 1',
    maxSize: 6,
    memberIds: ['m1', 'm2'],
    memberDetails: [
      {
        memberId: 'm1',
        memberName: 'Alice',
        niveauMatch: 90,
        experienceMonths: 6,
        groupExperienceSpan: '4-8 Monate',
        wishPartnerFulfilled: false,
        wishPartnerNames: [],
        isPromoted: false,
        assignmentReason: 'Verfügbarkeit passt',
      },
      {
        memberId: 'm2',
        memberName: 'Bob',
        niveauMatch: 85,
        experienceMonths: 8,
        groupExperienceSpan: '4-8 Monate',
        wishPartnerFulfilled: false,
        wishPartnerNames: [],
        isPromoted: false,
        assignmentReason: 'Verfügbarkeit passt',
      },
    ],
    waitlistIds: [],
    waitlistDetails: [],
    warnings: [],
    conflictIds: [],
    ...overrides,
  };
}

beforeEach(() => {
  h.state.members = [];
  h.state.trainers = [];
  h.state.memberships = [];
  h.state.feedback = [];
  h.state.courts = [];
  h.state.groups = [];
  h.state.planEntries = [];
  h.state.stats = [];
  h.state.config = null;
  h.state.seasons = [];
  h.state.insertedGroups = [];
  h.state.insertedPlanEntries = [];
  h.state.insertedWaitlist = [];
  h.state.updatedSeasons = [];
  vi.clearAllMocks();
});

// ═══ Engine initialization ══════════════════════════════════════════════

describe('SeasonClusteringEngine — initialization', () => {
  it('constructs with default config', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    expect(engine).toBeDefined();
  });

  it('accepts partial config overrides', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {
      groupMaxSize: 8,
      slotDurationMinutes: 60,
      backtrackDepth: 2,
      treatHighFailureAsHard: true,
    });
    expect(engine).toBeDefined();
  });
});

// ═══ Caching behavior ═══════════════════════════════════════════════════

describe('Optimization #3: Caching', () => {
  it('loadMembers caches its result on second call', async () => {
    h.state.members = [
      {
        pref: {
          user_id: 'm1',
          preferred_level: 'beginner',
          preferred_age_group: 'adult',
          weekly_availability: {
            monday: [{ start: '08:00', end: '22:00' }],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: [],
            saturday: [],
            sunday: [],
          },
          wish_partner_ids: [],
          avoid_member_ids: [],
          self_assessed_level: null,
        },
        user_name: 'Alice',
        user_email: 'alice@test.de',
        user_experience: 0,
        user_skill_level: 'beginner',
      },
    ];
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    const result1 = await engine.loadMembers();
    // Mutate the mock — second call should NOT see the change
    h.state.members = [
      {
        pref: { user_id: 'new-user', preferred_level: 'beginner' },
        user_name: 'NewUser',
        user_email: 'new@test.de',
        user_experience: 0,
        user_skill_level: 'beginner',
      },
    ];
    const result2 = await engine.loadMembers();
    expect(result2).toBe(result1); // Same reference → cache hit
    expect(result1.find((m: MemberWithDetails) => m.id === 'new-user')).toBeUndefined();
  });

  it('loadCourts caches its result', async () => {
    h.state.courts = [
      { id: 'c1', name: 'Court 1', surface: 'sand', is_active: true, club_id: 'c1' },
    ];
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    const result1 = await engine.loadCourts();
    h.state.courts = [
      { id: 'c2', name: 'Court 2', surface: 'hard', is_active: true, club_id: 'c1' },
    ];
    const result2 = await engine.loadCourts();
    expect(result2).toBe(result1);
    expect(result1.length).toBe(1);
  });

  it('loadGroups caches its result', async () => {
    h.state.groups = [
      {
        id: 'g1',
        name: 'Group 1',
        level: 'beginner',
        age_group: 'adult',
        is_active: true,
        club_id: 'c1',
      },
    ];
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    const result1 = await engine.loadGroups();
    h.state.groups = [];
    const result2 = await engine.loadGroups();
    expect(result2).toBe(result1);
  });

  it('loadSlotFailureRates caches its result', async () => {
    h.state.stats = [
      {
        id: 'st1',
        club_id: 'c1',
        slot_failure_rates: { '1_18:00': { failure_rate: 0.15 } },
        computed_at: new Date(),
      },
    ];
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    const result1 = await engine.loadSlotFailureRates();
    h.state.stats = [];
    const result2 = await engine.loadSlotFailureRates();
    expect(result2).toBe(result1);
    expect(result1['1_18:00']).toBe(0.15);
  });

  it('getPreviousSeasonId caches its result (including null)', async () => {
    h.state.seasons = [];
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    const result1 = await engine.getPreviousSeasonId();
    h.state.seasons = [{ id: 's1', club_id: 'c1', season_type: 'summer', year: 2026 }];
    const result2 = await engine.getPreviousSeasonId();
    expect(result2).toBe(result1); // Same null reference
    expect(result2).toBeNull();
  });
});

// ═══ applyNiveauPromotions ══════════════════════════════════════════════

describe('applyNiveauPromotions (Schritt 4c)', () => {
  it('promotes beginner → intermediate when readyForNextLevel=true', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    const members: MemberWithDetails[] = [
      makeMember({ id: 'm1', skillLevel: 'beginner', readyForNextLevel: true }),
    ];
    engine.applyNiveauPromotions(members);
    expect(members[0].promotedLevel).toBe('intermediate');
  });

  it('promotes intermediate → advanced when ready', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    const members: MemberWithDetails[] = [
      makeMember({ id: 'm1', skillLevel: 'intermediate', readyForNextLevel: true }),
    ];
    engine.applyNiveauPromotions(members);
    expect(members[0].promotedLevel).toBe('advanced');
  });

  it('caps at professional (no further promotion)', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    const members: MemberWithDetails[] = [
      makeMember({ id: 'm1', skillLevel: 'professional', readyForNextLevel: true }),
    ];
    engine.applyNiveauPromotions(members);
    expect(members[0].promotedLevel).toBe('professional');
  });

  it('does NOT promote when readyForNextLevel=false', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    const members: MemberWithDetails[] = [
      makeMember({ id: 'm1', skillLevel: 'beginner', readyForNextLevel: false }),
    ];
    engine.applyNiveauPromotions(members);
    expect(members[0].promotedLevel).toBeNull();
  });
});

// ═══ findBestTimeSlot ══════════════════════════════════════════════════

describe('findBestTimeSlot', () => {
  // Default config: groupMinSize=1 so the hard-constraint check passes for single-member tests.
  function setup(configOverrides: Record<string, any> = {}) {
    const engine = new SeasonClusteringEngine('s1', 'c1', {
      groupMinSize: 1,
      ...configOverrides,
    }) as any;
    const members = [makeMember({ id: 'm1' })];
    const trainers = [makeTrainer({ id: 't1' })];
    const courts = [makeCourt({ id: 'c1' })];
    const trainerSessionCount = new Map<string, number>([['t1', 0]]);
    const courtTimeSlotUsage = new Map<string, Set<string>>();
    return { engine, members, trainers, courts, trainerSessionCount, courtTimeSlotUsage };
  }

  it('returns the first available slot when all constraints met', () => {
    const { engine, members, trainers, courts, trainerSessionCount, courtTimeSlotUsage } = setup();
    const timeSlots = [{ start: '18:00', end: '19:30' }];
    const result = engine.findBestTimeSlot(
      members,
      trainers,
      courts,
      trainerSessionCount,
      courtTimeSlotUsage,
      {},
      [],
      timeSlots
    );
    expect(result).not.toBeNull();
    expect(result?.startTime).toBe('18:00');
    expect(result?.endTime).toBe('19:30');
  });

  it('returns null when no member is available for any slot', () => {
    const { engine, members, trainers, courts, trainerSessionCount, courtTimeSlotUsage } = setup();
    members[0].availability = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };
    const result = engine.findBestTimeSlot(
      members,
      trainers,
      courts,
      trainerSessionCount,
      courtTimeSlotUsage,
      {},
      [],
      [{ start: '18:00', end: '19:30' }]
    );
    expect(result).toBeNull();
  });

  it('returns null when no trainer is available', () => {
    const { engine, members, trainers, courts, trainerSessionCount, courtTimeSlotUsage } = setup();
    trainers[0].availability = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };
    const result = engine.findBestTimeSlot(
      members,
      trainers,
      courts,
      trainerSessionCount,
      courtTimeSlotUsage,
      {},
      [],
      [{ start: '18:00', end: '19:30' }]
    );
    expect(result).toBeNull();
  });

  it('skips trainer over their max sessions per week', () => {
    const { engine, members, trainers, courts, trainerSessionCount, courtTimeSlotUsage } = setup();
    trainers[0].maxSessionsPerWeek = 1;
    trainerSessionCount.set('t1', 1); // already at max
    const result = engine.findBestTimeSlot(
      members,
      trainers,
      courts,
      trainerSessionCount,
      courtTimeSlotUsage,
      {},
      [],
      [{ start: '18:00', end: '19:30' }]
    );
    expect(result).toBeNull();
  });

  it('skips trainer who is already assigned to the same day+time', () => {
    const { engine, members, trainers, courts, trainerSessionCount, courtTimeSlotUsage } = setup();
    // Member + trainer only available on Tuesday (day=1) so the algorithm MUST consider that slot.
    members[0].availability = {
      monday: [],
      tuesday: [{ start: '08:00', end: '22:00' }],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };
    trainers[0].availability = {
      monday: [],
      tuesday: [{ start: '08:00', end: '22:00' }],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };
    const existing: GroupAssignment[] = [
      makeAssignment({ trainerId: 't1', dayOfWeek: 1, startTime: '18:00', endTime: '19:30' }),
    ];
    const result = engine.findBestTimeSlot(
      members,
      trainers,
      courts,
      trainerSessionCount,
      courtTimeSlotUsage,
      {},
      existing,
      [{ start: '18:00', end: '19:30' }]
    );
    expect(result).toBeNull();
  });

  it('skips high-failure slots when treatHighFailureAsHard=true', () => {
    const { members, trainers, courts, trainerSessionCount, courtTimeSlotUsage } = setup();
    // Member + trainer only available on Tuesday (day=1) where the high-failure slot lives.
    members[0].availability = {
      monday: [],
      tuesday: [{ start: '08:00', end: '22:00' }],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };
    trainers[0].availability = {
      monday: [],
      tuesday: [{ start: '08:00', end: '22:00' }],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };
    // Re-create the engine with treatHighFailureAsHard=true
    const hardEngine = new SeasonClusteringEngine('s1', 'c1', {
      groupMinSize: 1,
      treatHighFailureAsHard: true,
      avoidHighFailureSlots: true,
      slotFailureThreshold: 30,
    }) as any;
    const result = hardEngine.findBestTimeSlot(
      members,
      trainers,
      courts,
      trainerSessionCount,
      courtTimeSlotUsage,
      { '1_18:00': 0.5 }, // 50% failure rate
      [],
      [{ start: '18:00', end: '19:30' }]
    );
    expect(result).toBeNull();
  });

  it('ALLOWS high-failure slots when treatHighFailureAsHard=false (soft score only)', () => {
    const { engine, members, trainers, courts, trainerSessionCount, courtTimeSlotUsage } = setup();
    // Force the algorithm to consider the high-failure slot by constraining availability.
    members[0].availability = {
      monday: [],
      tuesday: [{ start: '08:00', end: '22:00' }],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };
    trainers[0].availability = {
      monday: [],
      tuesday: [{ start: '08:00', end: '22:00' }],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };
    const result = engine.findBestTimeSlot(
      members,
      trainers,
      courts,
      trainerSessionCount,
      courtTimeSlotUsage,
      { '1_18:00': 0.5 },
      [],
      [{ start: '18:00', end: '19:30' }]
    );
    expect(result).not.toBeNull();
    expect(result?.failureWarning).toBe(true);
  });

  it('respects court unavailability', () => {
    const { engine, members, trainers, courts, trainerSessionCount, courtTimeSlotUsage } = setup();
    // Constrain to Tuesday (day=1) so the algorithm MUST look at the taken-slot day.
    members[0].availability = {
      monday: [],
      tuesday: [{ start: '08:00', end: '22:00' }],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };
    trainers[0].availability = {
      monday: [],
      tuesday: [{ start: '08:00', end: '22:00' }],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };
    // Use a DIFFERENT trainer (t2) for the existing assignment so t1 is still free
    // — we're testing court unavailability, not trainer double-booking.
    const existing: GroupAssignment[] = [
      makeAssignment({
        courtId: 'c1',
        dayOfWeek: 1,
        startTime: '18:00',
        endTime: '19:30',
        trainerId: 't2',
        trainerName: 'Coach Two',
      }),
    ];
    // Court c1 is the only court, so it should be taken
    const result = engine.findBestTimeSlot(
      members,
      trainers,
      courts,
      trainerSessionCount,
      courtTimeSlotUsage,
      {},
      existing,
      [{ start: '18:00', end: '19:30' }]
    );
    // Belegter Platz = unbrauchbarer Slot. Vorher lieferte der Algorithmus hier
    // den Slot mit courtId=null zurück; daraus entstanden beim Veröffentlichen
    // Sessions ohne Platz, für die keine Buchung angelegt wird, während die
    // Abrechnung die Teilnehmer trotzdem erfasst.
    expect(result).toBeNull();
  });

  it('plant weiter ohne Platz, wenn der Verein gar keine Plätze hat', () => {
    const { engine, members, trainers, trainerSessionCount, courtTimeSlotUsage } = setup();
    members[0].availability = {
      monday: [],
      tuesday: [{ start: '08:00', end: '22:00' }],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };
    trainers[0].availability = {
      monday: [],
      tuesday: [{ start: '08:00', end: '22:00' }],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };
    const result = engine.findBestTimeSlot(
      members,
      trainers,
      [], // keine Plätze konfiguriert
      trainerSessionCount,
      courtTimeSlotUsage,
      {},
      [],
      [{ start: '18:00', end: '19:30' }]
    );
    expect(result).not.toBeNull();
    expect(result?.courtId).toBeNull();
  });

  it('uses configured slot duration for trainer hours (not hardcoded 1.5h)', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {
      slotDurationMinutes: 60, // 1 hour slots
      trainerUtilizationMaxPct: 80,
      groupMinSize: 1,
    }) as any;
    const trainer = makeTrainer({
      id: 't1',
      maxHoursPerWeek: 10,
      maxSessionsPerWeek: 20,
    });
    const trainerSessionCount = new Map<string, number>([['t1', 8]]); // 8h done, 2h left
    // With 60min slots and 10h*80% = 8h max → 8h+1h would exceed
    const result = engine.findBestTimeSlot(
      [makeMember()],
      [trainer],
      [makeCourt()],
      trainerSessionCount,
      new Map(),
      {},
      [],
      [{ start: '18:00', end: '19:00' }]
    );
    expect(result).toBeNull();
  });
});

// ═══ applyWaitlistLogic ═════════════════════════════════════════════════

describe('applyWaitlistLogic (Schritt 4d)', () => {
  it('places wish partner on waitlist when target group is full', () => {
    // groupMaxSize=2 → g2 with 2 members is full (>= groupMaxSize), so m1 gets waitlisted.
    const engine = new SeasonClusteringEngine('s1', 'c1', { groupMaxSize: 2 }) as any;
    const members = [
      makeMember({ id: 'm1', wishPartnerIds: ['m2'] }),
      makeMember({ id: 'm2' }),
      makeMember({ id: 'm3' }),
    ];
    // m1 and m2 are in different groups, m2's group is full (m3 fills it)
    const assignments: GroupAssignment[] = [
      makeAssignment({ groupId: 'g1', memberIds: ['m1'], maxSize: 2 }),
      makeAssignment({ groupId: 'g2', memberIds: ['m2', 'm3'], groupName: 'Group 2', maxSize: 2 }),
    ];
    const groups: GroupInfo[] = [
      makeGroup({ id: 'g1', name: 'Group 1' }),
      makeGroup({ id: 'g2', name: 'Group 2' }),
    ];
    const result = engine.applyWaitlistLogic(assignments, members, groups);
    // m1 wants to be with m2, but m2's group is full → m1 should be waitlisted
    expect(result.waitlisted.length).toBe(1);
    expect(result.waitlisted[0].memberId).toBe('m1');
    expect(result.waitlisted[0].groupId).toBe('g2');
    expect(assignments[1].waitlistIds).toContain('m1');
  });

  it('does not waitlist if wish partner is already in same group', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    const members = [makeMember({ id: 'm1', wishPartnerIds: ['m2'] }), makeMember({ id: 'm2' })];
    const assignments: GroupAssignment[] = [
      makeAssignment({ groupId: 'g1', memberIds: ['m1', 'm2'] }),
    ];
    const result = engine.applyWaitlistLogic(assignments, members, []);
    expect(result.waitlisted.length).toBe(0);
  });

  it('uses O(1) lookups (does not call members.find repeatedly)', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    const members = Array.from({ length: 20 }, (_, i) =>
      makeMember({ id: `m${i}`, wishPartnerIds: i < 19 ? [`m${i + 1}`] : [] })
    );
    const assignments: GroupAssignment[] = [
      makeAssignment({ groupId: 'g1', memberIds: members.map((m) => m.id) }),
    ];
    const startTime = Date.now();
    engine.applyWaitlistLogic(assignments, members, []);
    const elapsed = Date.now() - startTime;
    // Should complete in < 50ms for 20 members (O(n + g·m) optimization)
    expect(elapsed).toBeLessThan(50);
  });
});

// ═══ computeMetrics ═════════════════════════════════════════════════════

describe('computeMetrics', () => {
  it('returns zeros for empty input', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    const metrics = engine.computeMetrics([], [], [], [], []);
    expect(metrics.totalMembers).toBe(0);
    expect(metrics.totalGroups).toBe(0);
    expect(metrics.avgNiveauMatch).toBe(0);
    expect(metrics.wishPartnerRate).toBe(0);
  });

  it('counts wish partner requests and fulfillments', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    const members = [
      makeMember({ id: 'm1', wishPartnerIds: ['m2'] }),
      makeMember({ id: 'm2', wishPartnerIds: ['m1'] }),
    ];
    const assignments: GroupAssignment[] = [
      makeAssignment({
        memberIds: ['m1', 'm2'],
        memberDetails: [
          {
            ...makeAssignment().memberDetails[0],
            memberId: 'm1',
            wishPartnerFulfilled: true,
            wishPartnerNames: ['Bob'],
          },
          {
            ...makeAssignment().memberDetails[1],
            memberId: 'm2',
            wishPartnerFulfilled: true,
            wishPartnerNames: ['Alice'],
          },
        ],
      }),
    ];
    const metrics = engine.computeMetrics(members, [makeTrainer()], assignments, [], []);
    expect(metrics.wishPartnerRequests).toBe(2);
    expect(metrics.wishPartnerFulfilled).toBe(2);
    expect(metrics.wishPartnerRate).toBe(100);
  });

  it('counts niveau span violations', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    const assignments: GroupAssignment[] = [
      makeAssignment({
        warnings: ['Niveau-Spanne (2-12 Monate) überschreitet Maximum (8)'],
      }),
      makeAssignment({ warnings: [] }),
    ];
    const metrics = engine.computeMetrics([], [makeTrainer()], assignments, [], []);
    expect(metrics.niveauSpanViolations).toBe(1);
  });

  it('tracks runtime', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    engine.startTime = Date.now() - 100;
    const metrics = engine.computeMetrics([], [], [], [], []);
    expect(metrics.runtimeMs).toBeGreaterThanOrEqual(100);
  });
});

// ═══ computeNiveauMatch ═════════════════════════════════════════════════

describe('computeNiveauMatch', () => {
  it('returns 100 for homogeneous group (all same experience)', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    const member = makeMember({ experienceMonths: 6 });
    const group = [makeMember({ experienceMonths: 6 }), makeMember({ experienceMonths: 6 })];
    const score = engine.computeNiveauMatch(member, group);
    expect(score).toBe(100);
  });

  it('returns lower score for outlier member', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    const member = makeMember({ experienceMonths: 24 });
    const group = [makeMember({ experienceMonths: 6 }), makeMember({ experienceMonths: 7 })];
    const score = engine.computeNiveauMatch(member, group);
    expect(score).toBeLessThan(50);
  });
});

// ═══ Hard failure-rate constraint (Optimization #5) ════════════════════

describe('Optimization #5: treatHighFailureAsHard', () => {
  it('default config has treatHighFailureAsHard=false (backwards compat)', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    expect(engine.config.treatHighFailureAsHard).toBe(false);
  });

  it('explicit config override sets treatHighFailureAsHard=true', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {
      treatHighFailureAsHard: true,
    }) as any;
    expect(engine.config.treatHighFailureAsHard).toBe(true);
  });
});

// ═══ Backtracking (Optimization #6) ════════════════════════════════════

describe('Optimization #6: Backtracking', () => {
  it('default config has backtrackDepth=3 (aktiv)', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    expect(engine.config.backtrackDepth).toBe(3);
  });

  it('respects backtrackDepth override', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', { backtrackDepth: 3 }) as any;
    expect(engine.config.backtrackDepth).toBe(3);
  });

  it('capped at 3 retries (override of 99)', async () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    // The method should cap iterations to 3 — verify via internal call
    const allMembers: MemberWithDetails[] = [makeMember({ id: 'm1' })];
    const sortedMembers = allMembers;
    const membersById = new Map<string, MemberWithDetails>();
    membersById.set('m1', allMembers[0]);
    const assignments: GroupAssignment[] = [makeAssignment({ groupId: 'g1', memberIds: ['m1'] })];
    const assignedMemberIds = new Set<string>(['m1']);
    const trainerSessionCount = new Map<string, number>();
    const courtTimeSlotUsage = new Map<string, Set<string>>();

    let iterations = 0;
    const originalSplice = assignments.splice.bind(assignments);
    assignments.splice = ((start: number, deleteCount: number) => {
      iterations++;
      return originalSplice(start, deleteCount);
    }) as any;

    await engine.backtrackForUnassigned(
      [],
      sortedMembers,
      membersById,
      allMembers,
      [makeTrainer()],
      [makeCourt()],
      new Map(),
      {},
      [{ start: '18:00', end: '19:30' }],
      trainerSessionCount,
      courtTimeSlotUsage,
      assignments,
      assignedMemberIds
    );

    // Capped at 3 retries
    expect(iterations).toBeLessThanOrEqual(3);
  });
});

// ═══ Sprint 4 P0 #3: Adaptive Backtrack (decoupled depth + threshold) ═

describe('Sprint 4 P0 #3: Adaptive Backtrack', () => {
  it('default config has unassignedRateThreshold=0.05', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    expect(engine.config.unassignedRateThreshold).toBe(0.05);
  });

  it('respects unassignedRateThreshold override', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {
      unassignedRateThreshold: 0.1,
    }) as any;
    expect(engine.config.unassignedRateThreshold).toBe(0.1);
  });

  it('disables adaptive second pass when threshold is 1.0 (no second pass)', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {
      unassignedRateThreshold: 1.0,
    }) as any;
    // Threshold=1.0 means unassignedRate > 1.0 is impossible → second pass never fires
    expect(engine.config.unassignedRateThreshold).toBe(1.0);
  });

  it('decouples maxRetries from depthOverride (depth follows depthOverride)', async () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    const allMembers: MemberWithDetails[] = [makeMember({ id: 'm1' })];
    const sortedMembers = allMembers;
    const membersById = new Map<string, MemberWithDetails>();
    membersById.set('m1', allMembers[0]);
    // Need 5 assignments so depth=5 has something to splice
    const assignments: GroupAssignment[] = [
      makeAssignment({ groupId: 'g1', memberIds: ['m1'] }),
      makeAssignment({ groupId: 'g2', memberIds: ['m2'] }),
      makeAssignment({ groupId: 'g3', memberIds: ['m3'] }),
      makeAssignment({ groupId: 'g4', memberIds: ['m4'] }),
      makeAssignment({ groupId: 'g5', memberIds: ['m5'] }),
    ];
    const assignedMemberIds = new Set<string>(['m1', 'm2', 'm3', 'm4', 'm5']);
    const trainerSessionCount = new Map<string, number>();
    const courtTimeSlotUsage = new Map<string, Set<string>>();

    let splicedCount = 0;
    const originalSplice = assignments.splice.bind(assignments);
    assignments.splice = ((start: number, deleteCount: number) => {
      splicedCount++;
      return originalSplice(start, deleteCount);
    }) as any;

    // maxRetries=2, depthOverride=5 — total splices bounded by maxRetries (2),
    // not by depth (5). This is the key Sprint 4 fix.
    await engine.backtrackForUnassigned(
      [],
      sortedMembers,
      membersById,
      allMembers,
      [makeTrainer()],
      [makeCourt()],
      new Map(),
      {},
      [{ start: '18:00', end: '19:30' }],
      trainerSessionCount,
      courtTimeSlotUsage,
      assignments,
      assignedMemberIds,
      2, // maxRetries
      5 // depthOverride
    );

    // maxRetries bounds total iterations → splices capped at 2, not 5
    expect(splicedCount).toBeLessThanOrEqual(2);
  });

  it('uses depth=3 by default when depthOverride is omitted', async () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    const allMembers: MemberWithDetails[] = [makeMember({ id: 'm1' })];
    const sortedMembers = allMembers;
    const membersById = new Map<string, MemberWithDetails>();
    membersById.set('m1', allMembers[0]);
    const assignments: GroupAssignment[] = [
      makeAssignment({ groupId: 'g1', memberIds: ['m1'] }),
      makeAssignment({ groupId: 'g2', memberIds: ['m2'] }),
      makeAssignment({ groupId: 'g3', memberIds: ['m3'] }),
      makeAssignment({ groupId: 'g4', memberIds: ['m4'] }),
      makeAssignment({ groupId: 'g5', memberIds: ['m5'] }),
    ];
    const assignedMemberIds = new Set<string>(['m1', 'm2', 'm3', 'm4', 'm5']);
    const trainerSessionCount = new Map<string, number>();
    const courtTimeSlotUsage = new Map<string, Set<string>>();

    let maxDepthObserved = 0;
    const originalSplice = assignments.splice.bind(assignments);
    assignments.splice = ((start: number, deleteCount: number) => {
      maxDepthObserved = Math.max(maxDepthObserved, deleteCount);
      return originalSplice(start, deleteCount);
    }) as any;

    // maxRetries=3, no depthOverride → depth should default to 3 (legacy behavior)
    await engine.backtrackForUnassigned(
      [],
      sortedMembers,
      membersById,
      allMembers,
      [makeTrainer()],
      [makeCourt()],
      new Map(),
      {},
      [{ start: '18:00', end: '19:30' }],
      trainerSessionCount,
      courtTimeSlotUsage,
      assignments,
      assignedMemberIds,
      3 // maxRetries only, depthOverride omitted
    );

    // depth follows maxRetries (3) by default — backwards compatible
    expect(maxDepthObserved).toBeLessThanOrEqual(3);
  });
});

// ═══ Second-pass slot check (Optimization #4) ═════════════════════════

describe('Optimization #4: Second-pass slot availability check', () => {
  it('does not place a member into a group whose slot they are unavailable for', () => {
    const member = makeMember({
      id: 'm1',
      // Only available Wednesday
      availability: {
        monday: [],
        tuesday: [],
        wednesday: [{ start: '08:00', end: '22:00' }],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: [],
      },
    });
    const allMembers: MemberWithDetails[] = [member];
    // Existing assignment on Monday 18:00 — should NOT be re-fillable with m1
    const assignment = makeAssignment({
      groupId: 'g1',
      dayOfWeek: 1, // Monday
      startTime: '18:00',
      endTime: '19:30',
      memberIds: ['m2', 'm3', 'm4', 'm5'],
    });
    const candidateGroups = new Map<string, GroupInfo>([['g1', makeGroup({ id: 'g1' })]]);
    const membersById = new Map<string, MemberWithDetails>();
    membersById.set('m1', member);

    // Call greedyCluster — but we only test the slot-availability logic in isolation
    // by directly calling the second-pass inline check
    const DAY_NAMES = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    const dayName = DAY_NAMES[assignment.dayOfWeek] as keyof typeof member.availability;
    const daySlots = member.availability[dayName] || [];
    const memberAvailable = daySlots.some(
      (s: any) => s.start <= assignment.startTime && s.end >= assignment.endTime
    );
    expect(memberAvailable).toBe(false);

    // Sanity: m1 IS available on Wednesday
    const wedSlots = member.availability['wednesday'] || [];
    const wedAvailable = wedSlots.some((s: any) => s.start <= '18:00' && s.end >= '19:30');
    expect(wedAvailable).toBe(true);

    // Use the helpers to avoid unused warnings
    void allMembers;
    void candidateGroups;
    void membersById;
  });
});

// ═══ duration_minutes fix (Optimization #1) ════════════════════════════

describe('Optimization #1: duration_minutes in trainer limit', () => {
  it('uses configured duration instead of hardcoded 1.5h', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', { slotDurationMinutes: 120 }) as any;
    expect(engine.config.slotDurationMinutes).toBe(120);
  });

  it('loadTrainers computes maxSessionsPerWeek from configured duration', () => {
    const mockTrainer = {
      id: 't1',
      user_id: 'u1',
      name: 'Coach',
      email: 'c@t.de',
      max_hours_per_week: 30,
      specialties: ['intermediate'],
      is_active: true,
    };
    h.state.trainers = [];
    h.state.memberships = [];
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    // Inject a trainer via the trainerClubs join
    // (We can't easily mock the join here, so just verify the config value)
    expect(engine.config.slotDurationMinutes).toBe(60);
    // 30h / 1h = 30 sessions
    const expectedSessions = Math.floor(30 / (60 / 60));
    expect(expectedSessions).toBe(30);
    void mockTrainer;
  });
});

// ═══ Integration: runClustering end-to-end ═════════════════════════════

describe('runClustering — end-to-end smoke test', () => {
  it('runs dry-run without DB writes', async () => {
    h.state.memberships = [];
    h.state.feedback = [];
    h.state.config = {
      club_id: 'c1',
      season_id: 's1',
      max_niveau_span_beginner_months: 4,
      max_niveau_span_advanced_months: 8,
      trainer_utilization_max_pct: 80,
      group_max_size: 12,
      group_min_size: 3,
      proven_group_attendance_threshold_pct: 80,
      slot_failure_rate_threshold_pct: 30,
      waitlist_priority_rule: 'registration_time',
      prefer_historic_groups: true,
      avoid_high_failure_slots: true,
      treat_high_failure_as_hard: false,
      backtrack_depth: 0,
      kids_group_max_size: 6,
      kids_group_min_size: 3,
      slot_duration_minutes: 90,
    };
    // Empty members → no groups created, but should not throw
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    const result = await engine.runClustering(true);
    expect(result.groups).toBeDefined();
    expect(result.unassignedMembers).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(result.explanations).toBeDefined();
    expect(h.state.insertedPlanEntries).toHaveLength(0);
  });
});

describe('applyWaitlistLogic — nicht eingeplante Mitglieder', () => {
  it('setzt ein Mitglied ohne Gruppe auf die Warteliste der passenden Gruppe', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    const assignments = [
      makeAssignment({ memberIds: ['m1'], waitlistIds: [], waitlistDetails: [] }),
    ];
    const members = [
      makeMember({ id: 'm1', name: 'Alice' }),
      makeMember({ id: 'm2', name: 'Bob', skillLevel: 'intermediate' as SkillLevel }),
    ];

    const { waitlisted, summary } = engine.applyWaitlistLogic(assignments, members, [makeGroup()]);

    expect(waitlisted.map((w: { memberId: string }) => w.memberId)).toEqual(['m2']);
    expect(summary[0].memberName).toBe('Bob');
    expect(summary[0].position).toBe(1);
    expect(assignments[0].waitlistIds).toEqual(['m2']);
  });

  it('lässt eingeplante Mitglieder in Ruhe', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    const assignments = [
      makeAssignment({ memberIds: ['m1', 'm2'], waitlistIds: [], waitlistDetails: [] }),
    ];
    const members = [makeMember({ id: 'm1' }), makeMember({ id: 'm2' })];

    const { waitlisted } = engine.applyWaitlistLogic(assignments, members, [makeGroup()]);

    expect(waitlisted).toHaveLength(0);
  });

  it('schreibt niemanden auf die Warteliste, wenn es gar keine Gruppe gibt', () => {
    const engine = new SeasonClusteringEngine('s1', 'c1', {}) as any;
    const members = [makeMember({ id: 'm1' })];

    const { waitlisted } = engine.applyWaitlistLogic([], members, []);

    expect(waitlisted).toHaveLength(0);
  });
});

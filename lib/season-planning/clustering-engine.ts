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
  memberSchedulePreferences,
  clubs,
  sessions,
  bookings,
} from '@/src/infrastructure/persistence/schema';
import {
  seasonWaitlists,
  trainerFeedback,
  seasonStatistics,
  seasonPlanningConfigs,
} from '@/src/infrastructure/persistence/season-planning-schema';
import { createLogger } from '@/lib/logger';
import { isMinorByBirthdate } from './conflict-utils';
import { DAY_LABELS, LEVEL_RANK, LEVEL_LABEL } from './schedule-constants';
import { createServiceClient } from '@/lib/supabase/service';
import {
  timeSlotsOverlap,
  computeNiveauMatchScore,
  sortMembersByPriority,
  balancedSliceSizes,
  scorePlan,
} from './clustering-utils';
import { randomUUID } from 'node:crypto';

const log = createLogger('season-clustering-engine');

/** Spätestes Ende einer Trainingseinheit mit Minderjährigen. */
const MINOR_LATEST_END = '20:00';
import { and, eq, asc, gte, inArray } from 'drizzle-orm';
import {
  resolveBundeslandCode,
  tryResolveBundeslandCode,
  isHolidayWeek,
  getMonday,
} from '@/lib/season-planning/holidays';
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
import { loadHolidaysForState } from './holidays.server';

// ============================================
// CONFIG DEFAULTS
// ============================================

/**
 * Tunable knobs for the clustering engine. Exported so the worker-client and
 * tests can reference the exact shape (vs. re-declaring it).
 */
export interface ClusteringConfig {
  maxNiveauLevelSteps: number; // max skill-level steps within a group, default 1
  // Niveau-Spanne in Monaten Erfahrung — DB-Spalten existieren (season_planning_configs),
  // werden hier nur typed durchgereicht; Matching nutzt weiterhin maxNiveauLevelSteps.
  maxNiveauSpanBeginner: number; // default 4
  maxNiveauSpanAdvanced: number; // default 8
  trainerUtilizationMaxPct: number; // default 100 (% of max_hours_per_week)
  groupMaxSize: number; // default 6
  groupMinSize: number; // default 1
  kidsGroupMaxSize: number; // default 6
  kidsGroupMinSize: number; // default 1
  slotDurationMinutes: number; // default 60
  provenGroupThreshold: number; // attendance pct, default 80
  slotFailureThreshold: number; // pct, default 30
  waitlistPriorityRule: string;
  preferHistoricGroups: boolean;
  avoidHighFailureSlots: boolean;
  // Optimization #5: treat high-failure-rate slots as a hard constraint (skip them)
  // instead of only as a soft -50 score. Default off to preserve backwards compatibility.
  treatHighFailureAsHard: boolean;
  // Optimization #6: depth of backtracking retries for unassigned members.
  // 0 = greedy only (original behavior). >0 = re-evaluate the last N groups and try
  // alternative slots before giving up.
  backtrackDepth: number;
  unassignedRateThreshold: number;
  // Fix 4: Doppelstunden — consecutive 2h block for team/advanced groups
  teamSlotMinutes: number; // duration for U18/advanced groups (default 120 = 2h)
  teamLevels: SkillLevel[]; // levels that get double slots (default: advanced, professional)
  minTrainingWeeks: number; // Fix 5: warn if season has fewer active weeks (default 12)
  // Sonntag ist standardmäßig spielfrei (Vereinsrealität / Arbeits- & Ruhezeitregeln
  // für Trainer). Opt-in pro Saison über die Wizard-Checkbox, nicht global änderbar.
  includeSunday: boolean; // default false
  // Multi-Start: mehrere feste Startvarianten rechnen und die beste behalten.
  // Keine DB-Spalte — abschaltbar für Benchmarks/Tests, die einen einzelnen
  // Greedy-Durchlauf messen wollen.
  multiStart: boolean; // default true
}

/** Eine Startvariante des Greedy-Laufs (siehe `multiStart`). */
interface PlanVariant {
  /** Erwachsene vor Kindern verplanen (Default: Kinder zuerst). */
  adultsFirst: boolean;
  /** Wunschpartner-/Vorsaison-Cluster als Sortierschlüssel nutzen. */
  useAffinity: boolean;
}

/** Präfix einer noch nicht in der DB angelegten Gruppe (siehe `saveToDatabase`). */
const PLACEHOLDER_GROUP_PREFIX = 'new:';

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

const DEFAULT_CONFIG: ClusteringConfig = {
  maxNiveauLevelSteps: 1,
  maxNiveauSpanBeginner: 4,
  maxNiveauSpanAdvanced: 8,
  trainerUtilizationMaxPct: 100,
  groupMaxSize: 6,
  groupMinSize: 1,
  kidsGroupMaxSize: 8, // Kinder vertragen größere Gruppen
  kidsGroupMinSize: 1,
  slotDurationMinutes: 60,
  provenGroupThreshold: 80,
  slotFailureThreshold: 30,
  waitlistPriorityRule: 'registration_time',
  preferHistoricGroups: true,
  avoidHighFailureSlots: true,
  treatHighFailureAsHard: false,
  // War 0 — damit lief der komplette Backtracking-Pfad in Produktion nie.
  // 3 ist der in tests/bench/clustering.bench.ts vermessene Wert.
  backtrackDepth: 3,
  unassignedRateThreshold: 0.05,
  teamSlotMinutes: 120,
  teamLevels: ['advanced', 'professional'],
  minTrainingWeeks: 12,
  includeSunday: false,
  multiStart: true,
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

// Bugfix (Q2-Audit): trainer.specialties sind deutsche Freitext-Strings aus der
// echten Vereinsverwaltung (z.B. 'Anfänger', 'Leistungssport', 'Kindertraining' —
// siehe scripts/seed-test-club-rheinland.ts), NIEMALS die SkillLevel-Enum-Keys
// ('beginner'/'advanced'/...). Ein direkter `specialties.includes(level)`-Vergleich
// matcht daher nie — dieser Keyword-Abgleich ersetzt den toten Vergleich.
const LEVEL_SPECIALTY_KEYWORDS: Record<SkillLevel, string[]> = {
  beginner: ['anfänger', 'einsteiger', 'breitensport', 'spielspaß'],
  intermediate: ['fortgeschritten', 'breitensport', 'mittel'],
  advanced: ['fortgeschritten', 'leistungssport', 'turniervorbereitung', 'mannschaft', 'wettkampf'],
  professional: ['leistungssport', 'turniervorbereitung', 'profi', 'wettkampf'],
};

function specialtyMatchesLevel(specialty: string, level: SkillLevel): boolean {
  const s = specialty.toLowerCase();
  return LEVEL_SPECIALTY_KEYWORDS[level].some((kw) => s.includes(kw));
}

// Bugfix (Q2-Audit): 'Kindertraining' fehlte hier — genau der String, den alle
// echten Kinder-Trainer-Spezialisierungen tragen (siehe seed-Skripte). Trainer
// mit dieser Spezialisierung bekamen dadurch bei Kids-Gruppen den -20-Malus
// statt +25-Bonus. Substring-Match statt exaktem includes() macht den Abgleich
// robust gegen Groß-/Kleinschreibung und Varianten.
const YOUTH_SPECIALTY_KEYWORDS = ['jugend', 'kind', 'kids', 'junior', 'u18'];

function isYouthSpecialty(specialty: string): boolean {
  const s = specialty.toLowerCase();
  return YOUTH_SPECIALTY_KEYWORDS.some((kw) => s.includes(kw));
}

// ============================================
// ENGINE
// ============================================

const UUID_MUSTER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Nur echte Gruppen-IDs dürfen in die uuid-Spalte `group_id`.
 *
 * Der Backtracking-Pfad legt Ersatzgruppen mit synthetischen IDs an
 * (`backtrack-2-<memberId>`, siehe unten) — dahinter steht keine
 * Trainingsgruppe, die ID enthält sogar eine Mitglieds-UUID. Bis zum
 * 16.08.2026 ging dieser Wert ungeprüft in den INSERT: sobald das Backtracking
 * griff, scheiterte jedes Speichern mit `22P02 invalid input syntax for uuid`,
 * und die Planerstellung antwortete mit 500. Der Trockenlauf blieb grün, weil
 * er nichts schreibt — der Fehler trat also erst beim echten Lauf auf.
 *
 * Dieselbe Spalte bekam von der Warteliste einen leeren String, wenn keine
 * Gruppe gefunden wurde — gleicher Fehler, anderer Weg.
 */
export function realGroupId(id: string | null | undefined): string | null {
  return id && UUID_MUSTER.test(id) ? id : null;
}

/**
 * Wochenverfügbarkeit aus der Datenbank in eine benutzbare Form bringen.
 *
 * Zwei Gründe, warum das nötig ist:
 *
 * 1. `member_schedule_preferences.weekly_availability` enthält den Wochenplan
 *    als **JSON-String**, nicht als Objekt (in der Live-DB: alle 88 Zeilen).
 *    Der frühere `as WeeklyAvailability`-Cast machte daraus zur Laufzeit einen
 *    String; `availability["monday"]` war damit `undefined`, jeder Slot-Vergleich
 *    scheiterte, und wer eine Präferenz abgegeben hatte, blieb ohne Gruppe —
 *    genau umgekehrt zur Absicht.
 * 2. Eine Präferenz ist laut Produktregel ein Vorteil, keine Bedingung. Wer
 *    nichts angegeben hat (fehlende Zeile, leeres Objekt, alle Tage leer), gilt
 *    als flexibel und bekommt die Standardverfügbarkeit — sonst fällt er aus
 *    der Planung, obwohl er ausdrücklich für sie vorgesehen ist.
 */
export function normalizeAvailability(
  raw: unknown,
  fallback: WeeklyAvailability
): WeeklyAvailability {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;

  const plan = value as WeeklyAvailability;
  const hatSlots = Object.values(plan).some((slots) => Array.isArray(slots) && slots.length > 0);
  return hatSlots ? plan : fallback;
}

export class SeasonClusteringEngine {
  private seasonId: string;
  private clubId: string;
  private config: ClusteringConfig;
  private startTime = 0;
  // Cached DB-loaded data so backtracking/second-pass can re-use them without re-querying.
  private _cachedMembers: (MemberWithDetails & { _unassignedReason?: string })[] | null = null;
  private _cachedTrainers: TrainerWithDetails[] | null = null;
  private _cachedCourts: CourtInfo[] | null = null;
  /** Wintersaison plant nur auf Hallenplätzen — für die Begründung unten wichtig. */
  private _istWinter = false;
  private _cachedGroups: GroupInfo[] | null = null;
  private _cachedSlotFailureRates: Record<string, number> | null = null;
  private _cachedHistoricGroups: Map<
    string,
    { groupId: string; attendance: number; members: string[] }
  > | null = null;
  private _cachedPreviousSeasonId: string | null | undefined = undefined;
  // Bugfix (Q2-Audit): memberId -> previous-season groupId, used to populate
  // MemberWithDetails.previousGroupId (was hardcoded to null) and to fold real
  // continuity ("saß letzte Saison in derselben Gruppe") into the affinity-based
  // group clustering in assignMembersToGroups.
  private _cachedPreviousGroupMemberships: Map<string, string> | null = null;

  // ═══ Sprint 4 P0 #1: Slot-Lookup-Cache (Sprint-4-Optimierung) ═══════
  // Pre-computed availability maps: key = `${kind}|${id}|${day}_${slotStart}`,
  // value = boolean. Replaces per-iteration Array.some() calls in findBestTimeSlot.
  private _memberSlotAvail: Map<string, boolean> | null = null;
  private _trainerSlotAvail: Map<string, boolean> | null = null;
  // Fallback for direct (non-`runClustering`) callers — when the cache above is
  // null (e.g. in unit tests that call `findBestTimeSlot` directly), these
  // arrays let `isMemberSlotAvailable` / `isTrainerSlotAvailable` do an O(n)
  // linear search + Array.some() instead of returning the `?? false` default
  // (which would make every member/trainer look unavailable).
  private _cachedMembersForSlotCheck:
    | (MemberWithDetails & {
        _unassignedReason?: string;
      })[]
    | null = null;
  private _cachedTrainersForSlotCheck: TrainerWithDetails[] | null = null;

  // Aktive Startvariante des laufenden Durchgangs (Multi-Start, siehe runClustering).
  private variant: PlanVariant = { adultsFirst: false, useAffinity: true };
  // Gruppen, die dieser Lauf neu erfinden will. Sie entstehen erst in
  // `saveToDatabase` als DB-Zeile — vorher sind es Platzhalter mit `new:`-ID.
  // Vorher legte `assignMembersToGroups` sie sofort per INSERT an, auch im
  // Dry Run: jeder Klick auf "Neu berechnen" im Wizard hinterließ verwaiste
  // `groups`-Zeilen.
  private pendingGroups = new Map<
    string,
    { name: string; level: SkillLevel; ageGroup: 'kids' | 'adult' }
  >();

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

    // Step 1: Load all data (cached so re-entrant calls — e.g. during backtracking —
    // don't re-query the DB).
    const members = await this.loadMembers();
    const trainers = await this.loadTrainers();
    const courts = await this.loadCourts();
    const groups = await this.loadGroups();
    const slotFailureRates = await this.loadSlotFailureRates();
    const historicGroups = await this.loadHistoricGroups();

    // Step 2: Build dynamic time slots based on configured duration
    const timeSlots = buildStandardTimeSlots(this.config.slotDurationMinutes);

    // Sprint 4 P0 #1: Pre-compute slot-availability caches so findBestTimeSlot can
    // do O(1) lookups instead of O(members × trainers) per (day, time) iteration.
    // Expected impact: 2000m run 32ms → ~18ms (-44%) per docs/SCALING_ANALYSIS.md.
    this.buildSlotAvailabilityCaches(members, trainers, timeSlots);

    // Step 3–6: Multi-Start.
    // Bei einem Greedy-Verfahren entscheidet die Startreihenfolge maßgeblich über
    // das Ergebnis — wer zuerst schneidet, bekommt die besten Trainer und Plätze.
    // Statt einen Constraint-Solver einzuführen, werden ein paar feste Varianten
    // gerechnet und über `scorePlan` verglichen. Deterministisch, weil die
    // Variantenliste konstant ist und der Rest der Engine keine Zufallsquelle hat.
    // Kosten: Faktor `variants.length` auf der reinen Rechenzeit (Daten werden nur
    // einmal geladen, die Slot-Caches nur einmal gebaut).
    const variants: PlanVariant[] = this.config.multiStart
      ? [
          { adultsFirst: false, useAffinity: true },
          { adultsFirst: true, useAffinity: true },
          { adultsFirst: false, useAffinity: false },
        ]
      : [{ adultsFirst: false, useAffinity: true }];

    let best: {
      score: number;
      assignments: GroupAssignment[];
      unassigned: Array<{ memberId: string; memberName: string; reason: string }>;
      waitlistSummary: ClusteringResult['waitlistSummary'];
      metrics: ClusteringMetrics;
      pendingGroups: Map<string, { name: string; level: SkillLevel; ageGroup: 'kids' | 'adult' }>;
    } | null = null;

    for (const variant of variants) {
      this.variant = variant;
      this.pendingGroups = new Map();
      // Mitglieder sind über die Varianten hinweg dieselben Objekte — der
      // Lauf-Zustand darauf muss zurückgesetzt werden.
      for (const m of members) {
        m._unassignedReason = undefined;
        m.promotedLevel = null;
      }

      // Schritt 4c: Höherstufungen
      this.applyNiveauPromotions(members);
      // Schritt 4b: Kandidatengruppen aus Bestand + bewährten Vorsaison-Gruppen
      const candidateGroups = this.buildCandidateGroups(members, trainers, groups, historicGroups);
      // Schritt 4a/4b: Greedy mit harten + weichen Constraints
      const { assignments, unassigned } = await this.greedyCluster(
        members,
        trainers,
        courts,
        candidateGroups,
        slotFailureRates,
        timeSlots
      );
      // Schritt 4d: Warteliste
      const waitlistResult = this.applyWaitlistLogic(assignments, members, groups);
      const metrics = this.computeMetrics(
        members,
        trainers,
        assignments,
        unassigned,
        waitlistResult.waitlisted
      );

      const score = scorePlan(metrics, unassigned.length);
      if (!best || score > best.score) {
        best = {
          score,
          assignments,
          // Die Begründungen hängen als `_unassignedReason` am gemeinsamen
          // Mitglieder-Objekt und werden von der nächsten Variante überschrieben
          // — hier einfrieren.
          unassigned: unassigned.map((m) => ({
            memberId: m.id,
            memberName: m.name,
            reason: m._unassignedReason || this.kapazitaetsHinweis(),
          })),
          waitlistSummary: waitlistResult.summary,
          metrics,
          pendingGroups: this.pendingGroups,
        };
      }
    }

    // `variants` ist nie leer, `best` daher immer gesetzt — der Non-Null-Assert
    // spart einen unerreichbaren Fehlerpfad.
    const winner = best!;
    const assignments = winner.assignments;
    const metrics = winner.metrics;
    this.pendingGroups = winner.pendingGroups;
    if (variants.length > 1) {
      log.info('Multi-Start: beste Variante gewählt', {
        seasonId: this.seasonId,
        score: winner.score,
        variants: variants.length,
      });
    }

    // Step 7b: Fix 5 — Mindest-Trainingswochen prüfen
    const [currentSeason] = await db
      .select({ start: seasons.start_date, end: seasons.end_date })
      .from(seasons)
      .where(eq(seasons.id, this.seasonId));
    const trainingWeekWarnings: string[] = [];
    if (currentSeason?.start && currentSeason?.end) {
      const totalWeeks = Math.round(
        (new Date(currentSeason.end).getTime() - new Date(currentSeason.start).getTime()) /
          (7 * 86400000)
      );
      if (totalWeeks < this.config.minTrainingWeeks) {
        trainingWeekWarnings.push(
          `⚠️ Saison nur ${totalWeeks} Wochen lang (Minimum: ${this.config.minTrainingWeeks}). Nach Abzug von Ferienwochen bleiben ggf. weniger als 10 aktive Trainingswochen.`
        );
      }
    }

    // Step 7c: Ferien-adjustierte Sessionzahl berechnen und in Explanations aufnehmen
    const holidayWarnings: string[] = [];
    let holidayFallbackWarning: string | null = null;
    try {
      const [clubRow] = await db
        .select({ bundesland: clubs.bundesland })
        .from(clubs)
        .where(eq(clubs.id, this.clubId))
        .limit(1);
      // Bundesland-Eingabe kommt aus clubs.bundesland (freier Text, optional).
      // `resolveBundeslandCode` akzeptiert Kürzel/Klarnamen und fällt für
      // unbekannte Eingaben dokumentiert auf 'HE' (Hessen) zurück — Ferien
      // werden dadurch nie «leise» übersprungen. Hier unterscheiden wir die
      // beiden Fallback-Fälle (NULL vs. unbekannter Text) für den Admin.
      const rawBundesland = clubRow?.bundesland ?? null;
      const code = resolveBundeslandCode(rawBundesland);
      const holidays = await loadHolidaysForState(code);
      if (holidays.length > 0) {
        if (!rawBundesland) {
          // Fall 1: clubs.bundesland ist gar nicht gepflegt — wir verwenden
          // den Default 'HE'. Sichtbar machen, damit Admins ihre Vereins-
          // Konfiguration vervollständigen können.
          holidayFallbackWarning = `⚠️ Vereins-Bundesland nicht gesetzt — Ferien werden mit Default 'HE' (Hessen) gefiltert. Tipp: clubs.bundesland setzen, damit Sommer-/Herbstferien dem realen Bundesland entsprechen.`;
          holidayWarnings.push(holidayFallbackWarning);
          log.warn('Club without bundesland falls back to HE holidays', {
            clubId: this.clubId,
            seasonId: this.seasonId,
          });
        } else if (tryResolveBundeslandCode(rawBundesland) === null) {
          // Fall 2: clubs.bundesland ist gesetzt, aber das Kürzel ist nicht
          // in BUNDESLAND_NAMES — resolveBundeslandCode fällt still auf 'HE'
          // zurück. Schließt 'HH', 'BY', Klarnamen und Synonyme ein.
          holidayFallbackWarning = `⚠️ Vereins-Bundesland '${rawBundesland}' nicht erkannt — Ferien werden mit Default 'HE' (Hessen) gefiltert. Bitte das Kürzel in clubs.bundesland korrigieren.`;
          holidayWarnings.push(holidayFallbackWarning);
          log.warn('Club bundesland unparseable, falling back to HE', {
            clubId: this.clubId,
            seasonId: this.seasonId,
            raw: rawBundesland,
          });
        }
        if (currentSeason?.start && currentSeason?.end) {
          let holidayWeekCount = 0;
          const cursor = new Date(getMonday(new Date(currentSeason.start)));
          const end = new Date(currentSeason.end);
          while (cursor <= end) {
            if (isHolidayWeek(cursor.toISOString().slice(0, 10), holidays)) holidayWeekCount++;
            cursor.setDate(cursor.getDate() + 7);
          }
          if (holidayWeekCount > 0) {
            const totalWeeks = Math.round(
              (new Date(currentSeason.end).getTime() - new Date(currentSeason.start).getTime()) /
                (7 * 86400000)
            );
            const activeWeeks = totalWeeks - holidayWeekCount;
            holidayWarnings.push(
              `📅 ${holidayWeekCount} Ferienwochen (${code}) erkannt — effektive Trainingswochen: ${activeWeeks} von ${totalWeeks}. Rechnungsvorschau und Sessionzahl basieren auf diesen ${activeWeeks} Wochen.`
            );
          }
        }
      }
    } catch {
      // non-critical — skip
    }

    // Step 8: Generate explanations
    const explanations = [
      ...trainingWeekWarnings,
      ...holidayWarnings,
      ...this.generateExplanations(assignments, members, trainers),
    ];

    const result: ClusteringResult = {
      groups: assignments,
      unassignedMembers: winner.unassigned,
      waitlistSummary: winner.waitlistSummary,
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
        maxNiveauLevelSteps:
          (dbConfig as Record<string, unknown>).max_niveau_level_steps != null
            ? Number((dbConfig as Record<string, unknown>).max_niveau_level_steps)
            : DEFAULT_CONFIG.maxNiveauLevelSteps,
        maxNiveauSpanBeginner:
          (dbConfig as Record<string, unknown>).max_niveau_span_beginner_months != null
            ? Number((dbConfig as Record<string, unknown>).max_niveau_span_beginner_months)
            : DEFAULT_CONFIG.maxNiveauSpanBeginner,
        maxNiveauSpanAdvanced:
          (dbConfig as Record<string, unknown>).max_niveau_span_advanced_months != null
            ? Number((dbConfig as Record<string, unknown>).max_niveau_span_advanced_months)
            : DEFAULT_CONFIG.maxNiveauSpanAdvanced,
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
        treatHighFailureAsHard:
          dbConfig.treat_high_failure_as_hard ?? DEFAULT_CONFIG.treatHighFailureAsHard,
        backtrackDepth: dbConfig.backtrack_depth ?? DEFAULT_CONFIG.backtrackDepth,
        kidsGroupMaxSize: dbConfig.kids_group_max_size ?? DEFAULT_CONFIG.kidsGroupMaxSize,
        kidsGroupMinSize: dbConfig.kids_group_min_size ?? DEFAULT_CONFIG.kidsGroupMinSize,
        slotDurationMinutes: dbConfig.slot_duration_minutes ?? DEFAULT_CONFIG.slotDurationMinutes,
        // Sprint 4 P0 #3 (Adaptive Backtrack): DB column added in
        // supabase/migrations/20260610_add_unassigned_rate_threshold.sql.
        // Range 0..1, default 0.05 (5%) via DB DEFAULT.
        unassignedRateThreshold:
          dbConfig.unassigned_rate_threshold ?? DEFAULT_CONFIG.unassignedRateThreshold,
        teamSlotMinutes: DEFAULT_CONFIG.teamSlotMinutes,
        teamLevels: DEFAULT_CONFIG.teamLevels,
        minTrainingWeeks: DEFAULT_CONFIG.minTrainingWeeks,
        // Keine DB-Spalte (request-scoped Wizard-Checkbox bzw. Test-/Bench-Schalter)
        // — Wert aus dem Konstruktor-Merge erhalten statt auf den Default
        // zurückzufallen.
        includeSunday: this.config.includeSunday,
        multiStart: this.config.multiStart,
      };
    }
  }

  private async loadMembers(): Promise<(MemberWithDetails & { _unassignedReason?: string })[]> {
    if (this._cachedMembers) return this._cachedMembers;

    // ── 1. Season-specific user_training_preferences (primary source) ──
    // Members who submitted the per-season form via the planning wizard. These
    // carry the richest data (unavailable_dates, avoid_member_ids,
    // self_assessed_level) and take precedence over the club-wide baseline.
    const seasonPrefs = await db
      .select({
        pref: userTrainingPreferences,
        user_name: users.full_name,
        user_email: users.email,
        user_experience: users.experience_months,
        user_skill_level: users.skill_level,
        user_dob: users.date_of_birth,
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
    const seasonMemberIds = new Set<string>();
    for (const p of seasonPrefs) seasonMemberIds.add(p.pref.user_id);

    // ── 2. Club-baseline member_schedule_preferences (fallback) ──
    // Bridge members who filled in Wunsch-Tage/Zeiten via /member/preferences
    // (writes here, per club) but never submitted per-season prefs in the
    // planning wizard. Without this row, the engine would return 0 groups for
    // any season whose members happen to all live in this table — bug fix.
    const baselinePrefs = await db
      .select({
        pref: memberSchedulePreferences,
        user_name: users.full_name,
        user_email: users.email,
        user_experience: users.experience_months,
        user_skill_level: users.skill_level,
        user_dob: users.date_of_birth,
      })
      .from(memberSchedulePreferences)
      .innerJoin(users, eq(memberSchedulePreferences.user_id, users.id))
      .where(eq(memberSchedulePreferences.club_id, this.clubId));

    // Also load user_club_memberships to:
    //   (a) check is_minor / age_group info
    //   (b) filter baseline rows to active 'member' role in this club
    //       (skip admins / trainers / superadmins accidentally present in msp)
    const memberships = await db
      .select({
        user_id: userClubMemberships.user_id,
        role: userClubMemberships.role,
        include_in_planning: userClubMemberships.include_in_planning,
      })
      .from(userClubMemberships)
      .where(
        and(eq(userClubMemberships.club_id, this.clubId), eq(userClubMemberships.is_active, true))
      );
    const membershipRoleMap = new Map<string, string>();
    for (const m of memberships) {
      membershipRoleMap.set(m.user_id, m.role);
    }

    // Baseline rows are eligible only if:
    //   (a) NOT already covered by a per-season user_training_preferences row
    //      (so a user who submitted both doesn't get double-counted), AND
    //   (b) they hold an active 'member'-role membership in this club.
    //
    // ROLE BOUNDARY (don't loosen accidentally): utp above requires
    // `user_role = 'member'`, and this filter requires the membership role
    // 'member'. A user with `user_role = 'trainer'` on utp paired with role =
    // 'member' on memberships is intentionally excluded for THIS season —
    // they're treated as a trainer. If you touch this, also coordinate with
    // `loadTrainers()` above (same row, different role).
    const eligibleBaseline = baselinePrefs.filter(
      (bp) =>
        !seasonMemberIds.has(bp.pref.user_id) && membershipRoleMap.get(bp.pref.user_id) === 'member'
    );

    // Load trainer feedback from previous season (unchanged)
    const previousSeasonId = await this.getPreviousSeasonId();
    void previousSeasonId; // re-used below via feedbackMap
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

    // ── 3. Merge — per-season rows take precedence. Baseline rows are
    //      normalised to the seasonPrefs row shape with the three utp-only
    //      fields (unavailable_dates, avoid_member_ids, self_assessed_level)
    //      explicitly typed as nullable so the msp rows can carry nulls
    //      without `as unknown as` acrobatics. Downstream map() reads them
    //      with `?? []` / `?? null` for runtime safety. ──
    type SeasonPrefRow = (typeof seasonPrefs)[number];
    // MergedPrefRow represents the union shape we need for downstream
    // consumers (which read `weekly_availability`, `wish_partner_ids`,
    // `unavailable_dates`, `avoid_member_ids`, etc.). The 3 utp-only fields
    // are marked OPTIONAL because baseline rows from
    // `memberSchedulePreferences` don't carry those columns; downstream
    // readers do `?? []` / `?? null` runtime guards to handle the absence.
    // seasonPrefs rows DO have these fields populated at runtime.
    type MergedPrefRow = Omit<SeasonPrefRow, 'pref'> & {
      pref: Omit<
        SeasonPrefRow['pref'],
        | 'unavailable_dates'
        | 'avoid_member_ids'
        | 'self_assessed_level'
        | 'preferred_group_ids'
        | 'priority'
      > & {
        unavailable_dates?: string[] | null;
        avoid_member_ids?: string[] | null;
        self_assessed_level?: string | null;
        // Q2-Audit: msp (baseline) hat keine preferred_group_ids/priority-Spalten —
        // gleiche Begründung wie die drei utp-only Felder oben.
        preferred_group_ids?: string[] | null;
        priority?: number | null;
      };
    };
    const mergedRows: MergedPrefRow[] = [
      ...seasonPrefs,
      // TS2352 fires on a direct `as MergedPrefRow[]` cast because the
      // upstream `bp.pref` (memberSchedulePreferences row) has different
      // JSON-cast shapes than userTrainingPreferences (e.g.
      // `wish_partner_ids: Json | null` vs `string[] | null`). The
      // double-cast `as unknown as MergedPrefRow[]` is the canonical TS
      // escape hatch for "matches at runtime but TS can't see it" — the
      // structural overlap is insufficient. Runtime is correct because
      // downstream consumers do `?? []` / `?? null` / `as string[]`
      // guards. Tracked as a P2 ticket: merge-pref-tables (unify
      // member_schedule_preferences + user_training_preferences schemas
      // so the cast disappears entirely).
      ...(eligibleBaseline.map((bp) => ({
        pref: {
          ...bp.pref,
          // Stamp the utp-only fields as null on baseline rows.
          unavailable_dates: null,
          avoid_member_ids: null,
          self_assessed_level: null,
          preferred_group_ids: null,
          priority: null,
        },
        user_name: bp.user_name,
        user_email: bp.user_email,
        user_experience: bp.user_experience,
        user_skill_level: bp.user_skill_level,
      })) as unknown as MergedPrefRow[]),
    ];

    const previousGroups = await this.loadPreviousGroupMemberships();

    const result = mergedRows.map((p) => {
      const fb = feedbackMap.get(p.pref.user_id);
      const skillLevel = (p.user_skill_level || p.pref.preferred_level || 'beginner') as SkillLevel;
      const prefAgeGroup = p.pref.preferred_age_group || '';
      // Any under-18 age group is school-bound on weekdays → needs after-14:00 slots.
      // Das Geburtsdatum entscheidet, wenn vorhanden: `preferred_age_group` ist
      // ein Wunschfeld aus dem Präferenz-Formular und bei Mitgliedern ohne
      // Präferenzen gar nicht gefüllt — ein 12-Jähriger wäre dann als
      // Erwachsener in einen 20-Uhr-Slot gerutscht.
      const isMinor =
        isMinorByBirthdate((p as { user_dob?: unknown }).user_dob) ??
        (prefAgeGroup === 'kids' ||
          prefAgeGroup === 'youth' ||
          prefAgeGroup === 'junior' ||
          prefAgeGroup === 'u18' ||
          prefAgeGroup === 'children' ||
          membershipRoleMap.get(p.pref.user_id) === 'junior');
      // Opt #5: count unavailable dates per day-of-week for penalty scoring
      const unavailDates = (p.pref.unavailable_dates as string[] | null) ?? [];
      const unavailByDow: Record<number, number> = {};
      for (const d of unavailDates) {
        const dow = (new Date(d).getDay() + 6) % 7; // 0=Mon..6=Sun
        unavailByDow[dow] = (unavailByDow[dow] ?? 0) + 1;
      }
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
        // Präferenz ist Vorteil, keine Bedingung: wer nichts (Brauchbares)
        // angegeben hat, gilt als flexibel statt als nie verfügbar.
        availability: normalizeAvailability(
          p.pref.weekly_availability,
          this.buildDefaultAvailability()
        ),
        wishPartnerIds: (p.pref.wish_partner_ids as string[]) || [],
        avoidMemberIds: ((p.pref.avoid_member_ids as string[] | null) ?? []) as string[],
        selfAssessedLevel: (p.pref.self_assessed_level as SkillLevel | null) ?? null,
        // Bugfix (Q2-Audit): war hartcodiert `null` — jetzt aus der Vorsaison befüllt.
        previousGroupId: previousGroups.get(p.pref.user_id) ?? null,
        isMinor,
        // Bugfix (Q2-Audit): wurden aus der DB geladen, aber nie in MemberWithDetails
        // übernommen — dadurch für den Rest des Engines unsichtbar.
        maxSessionsPerWeek: p.pref.max_sessions_per_week || 1,
        preferredCourtIds: ((p.pref.preferred_court_ids as string[] | null) ?? []) as string[],
        preferredGroupIds: ((p.pref.preferred_group_ids as string[] | null) ?? []) as string[],
        priority: p.pref.priority ?? 5,
        _unavailByDow: unavailByDow,
        _unassignedReason: undefined,
      };
    });

    // ── 4. Mitglieder ohne jede Präferenz-Zeile ───────────────────────────
    // Wer für die Planung vorgesehen ist (`include_in_planning`), aber weder
    // Saison- noch Club-Präferenzen abgegeben hat, tauchte im Algorithmus
    // überhaupt nicht auf: `mergedRows` speiste sich nur aus den beiden
    // Präferenz-Tabellen. Bei TC Rheinland waren das 22 von 60 Mitgliedern —
    // die Konfliktprüfung meldete sie hinterher als "in keiner Gruppe",
    // obwohl der Verein sie eingeplant sehen will.
    //
    // Keine Angabe ist keine Absage: sie bekommen — wie Trainer ohne
    // eingereichte Verfügbarkeit weiter unten — die Standard-Verfügbarkeit und
    // werden damit ganz normal eingruppiert. Niveau und Erfahrung kommen aus
    // dem Profil, die harten Regeln (Schulzeiten für Kinder, Platz, Trainer)
    // gelten unverändert. Wer nicht mitgeplant werden soll, wird in Schritt 1
    // abgewählt — dafür ist `include_in_planning` da.
    const coveredIds = new Set(result.map((m) => m.id));
    const missingIds = memberships
      .filter(
        (m) => m.role === 'member' && m.include_in_planning !== false && !coveredIds.has(m.user_id)
      )
      .map((m) => m.user_id);

    if (missingIds.length > 0) {
      const defaultAvailability = this.buildDefaultAvailability();
      const profiles = await db
        .select({
          id: users.id,
          full_name: users.full_name,
          email: users.email,
          skill_level: users.skill_level,
          experience_months: users.experience_months,
          date_of_birth: users.date_of_birth,
        })
        .from(users)
        .where(inArray(users.id, missingIds));

      for (const u of profiles) {
        const fb = feedbackMap.get(u.id);
        result.push({
          id: u.id,
          name: u.full_name || u.email || 'Unbekannt',
          email: u.email || '',
          skillLevel: (u.skill_level || 'beginner') as SkillLevel,
          experienceMonths: u.experience_months || 0,
          attendanceQuote: fb?.attendance ?? null,
          readyForNextLevel: fb?.ready ?? false,
          recommendedLevel: fb?.level ?? null,
          promotedLevel: null,
          availability: defaultAvailability,
          wishPartnerIds: [],
          avoidMemberIds: [],
          selfAssessedLevel: null,
          previousGroupId: previousGroups.get(u.id) ?? null,
          isMinor: isMinorByBirthdate(u.date_of_birth) ?? membershipRoleMap.get(u.id) === 'junior',
          maxSessionsPerWeek: 1,
          preferredCourtIds: [],
          preferredGroupIds: [],
          // Niedrigste Priorität: bei Platzmangel weicht zuerst, wer nichts
          // angegeben hat — vor jemandem mit ausdrücklichem Wunsch.
          priority: 1,
          _unavailByDow: {},
          _unassignedReason: undefined,
        });
      }
    }

    this._cachedMembers = result;
    return result;
  }

  private async loadTrainers(): Promise<TrainerWithDetails[]> {
    if (this._cachedTrainers) return this._cachedTrainers;
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
        // Gleiche Behandlung wie bei Mitgliedern — die Spalte hat dieselbe
        // String-Form, und ein Trainer ohne hinterlegte Zeiten ist einsetzbar,
        // nicht abwesend.
        availability: normalizeAvailability(
          p.pref.weekly_availability,
          this.buildDefaultAvailability()
        ),
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

    // Primary source: trainer_clubs join
    let clubTrainers = await db
      .select({ trainer: trainers })
      .from(trainers)
      .innerJoin(trainerClubs, eq(trainers.id, trainerClubs.trainer_id))
      .where(and(eq(trainerClubs.club_id, this.clubId), eq(trainers.is_active, true)));

    // Fallback: user_club_memberships with role='trainer'
    if (clubTrainers.length === 0) {
      clubTrainers = await db
        .select({ trainer: trainers })
        .from(userClubMemberships)
        .innerJoin(trainers, eq(userClubMemberships.user_id, trainers.user_id))
        .where(
          and(
            eq(userClubMemberships.club_id, this.clubId),
            eq(userClubMemberships.role, 'trainer'),
            eq(userClubMemberships.is_active, true),
            eq(trainers.is_active, true)
          )
        );
    }

    for (const { trainer } of clubTrainers) {
      if (submittedTrainerIds.has(trainer.id)) continue;
      loadedTrainers.push({
        id: trainer.id,
        name: trainer.name || 'Unbekannt',
        specialties: (trainer.specialties as string[]) || [],
        maxHoursPerWeek: trainer.max_hours_per_week || 30,
        utilizationPct: this.config.trainerUtilizationMaxPct,
        availability: defaultAvailability,
        // Compute max sessions from configured slot duration (was hardcoded to 1.5h)
        maxSessionsPerWeek: Math.floor(
          (trainer.max_hours_per_week || 30) / (this.config.slotDurationMinutes / 60)
        ),
        preferredCourtIds: [],
        canTeachGroups: (trainer.specialties as string[]) || [],
        sessionsAssigned: 0,
      });
    }

    this._cachedTrainers = loadedTrainers;
    return loadedTrainers;
  }

  /**
   * Begründung für Mitglieder, die ohne Gruppe bleiben, wenn die Engine keinen
   * spezifischen Grund gesetzt hat.
   *
   * Vorher stand hier "Keine passende Gruppe gefunden". Das liest sich wie ein
   * Zuordnungsfehler und hat die Fehlersuche in die Irre geführt — tatsächlich
   * ist es fast immer die Platzkapazität. In einer Wintersaison plant die Engine
   * ausschliesslich auf Hallenplätzen; bei TC Rheinland sind das 2 von 6.
   */
  private kapazitaetsHinweis(): string {
    const plaetze = this._cachedCourts?.length ?? 0;
    const trainer = this._cachedTrainers?.length ?? 0;
    const platzWort = plaetze === 1 ? '1 nutzbarer Platz' : `${plaetze} nutzbare Plätze`;
    const winter = this._istWinter ? ' (Wintersaison: nur Hallenplätze)' : '';
    return `Keine freie Kapazität — ${platzWort}${winter} und ${trainer} Trainer sind ausgelastet`;
  }

  private async loadCourts(): Promise<CourtInfo[]> {
    if (this._cachedCourts) return this._cachedCourts;

    // Winter-Saison: nur Hallen-Courts (has_indoor=true). Sommer: alle aktiven Courts.
    const [currentSeason] = await db
      .select({ season_type: seasons.season_type })
      .from(seasons)
      .where(eq(seasons.id, this.seasonId));
    const isWinter = currentSeason?.season_type === 'winter';
    this._istWinter = isWinter;

    const filter = isWinter
      ? and(
          eq(courts.club_id, this.clubId),
          eq(courts.is_active, true),
          eq(courts.usable_for_training, true),
          eq(courts.has_indoor, true)
        )
      : and(
          eq(courts.club_id, this.clubId),
          eq(courts.is_active, true),
          eq(courts.usable_for_training, true)
        );

    let courtRows = await db.select().from(courts).where(filter);

    // Ein Verein ohne Halle hätte im Winter sonst gar keinen Platz — die Planung
    // liefe durch und erzeugte lautlos Gruppen ohne Platz, für die beim
    // Veröffentlichen keine Buchungen entstehen. Viele Vereine spielen im Winter
    // auf Freiplätzen weiter; die Außenplätze sind hier die richtige Rückfallebene.
    if (isWinter && courtRows.length === 0) {
      courtRows = await db
        .select()
        .from(courts)
        .where(
          and(
            eq(courts.club_id, this.clubId),
            eq(courts.is_active, true),
            eq(courts.usable_for_training, true)
          )
        );
      if (courtRows.length > 0) {
        log.warn('Wintersaison ohne Hallenplatz — Planung weicht auf Außenplätze aus', {
          clubId: this.clubId,
          seasonId: this.seasonId,
          courts: courtRows.length,
        });
      }
    }

    const result = courtRows.map((c) => ({
      id: c.id,
      name: c.name,
      surface: c.surface,
      isActive: c.is_active,
    }));
    this._cachedCourts = result;
    return result;
  }

  private async loadGroups(): Promise<GroupInfo[]> {
    if (this._cachedGroups) return this._cachedGroups;
    // Supabase REST, not Drizzle — direct postgres/Drizzle connections are
    // unreliable from the dev environment (see CLAUDE.md).
    const { data: groupRows, error } = await createServiceClient()
      .from('groups')
      .select('id, name, level, age_group, max_size')
      .eq('club_id', this.clubId)
      .eq('is_active', true);
    if (error) throw new Error(`Failed to load groups: ${error.message}`);
    const result = (groupRows ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      level: g.level as SkillLevel,
      ageGroup: g.age_group ?? '',
      // Q2-Audit (Punkt 11): individuelle Gruppenkapazität, falls in der DB gesetzt.
      maxSize: g.max_size ?? null,
    }));
    this._cachedGroups = result;
    return result;
  }

  private async loadSlotFailureRates(): Promise<Record<string, number>> {
    if (this._cachedSlotFailureRates) return this._cachedSlotFailureRates;
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
    this._cachedSlotFailureRates = rates;
    return rates;
  }

  private async loadHistoricGroups(): Promise<
    Map<string, { groupId: string; attendance: number; members: string[] }>
  > {
    if (this._cachedHistoricGroups) return this._cachedHistoricGroups;
    const previousSeasonId = await this.getPreviousSeasonId();
    if (!previousSeasonId) {
      this._cachedHistoricGroups = new Map();
      return this._cachedHistoricGroups;
    }

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
    this._cachedHistoricGroups = result;

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
    if (this._cachedPreviousSeasonId !== undefined) return this._cachedPreviousSeasonId;
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
    const result = idx <= 0 ? null : previousSeasons[idx - 1].id;
    this._cachedPreviousSeasonId = result;
    return result;
  }

  /**
   * Bugfix (Q2-Audit): memberId -> groupId aus der Vorsaison. War bisher komplett
   * ungenutzt (previousGroupId wurde in loadMembers() hartcodiert auf null gesetzt).
   * Erste Fundstelle pro Mitglied gewinnt (ein Mitglied kann durch Mehrfach-Sessions
   * theoretisch in mehreren Vorsaison-Gruppen gewesen sein — hier reicht ein grober
   * Kontinuitäts-Hinweis, kein exakter Verlauf).
   */
  private async loadPreviousGroupMemberships(): Promise<Map<string, string>> {
    if (this._cachedPreviousGroupMemberships) return this._cachedPreviousGroupMemberships;
    const result = new Map<string, string>();
    this._cachedPreviousGroupMemberships = result;

    const previousSeasonId = await this.getPreviousSeasonId();
    if (!previousSeasonId) return result;

    const entries = await db
      .select({
        group_id: seasonPlanEntries.group_id,
        expected_participants: seasonPlanEntries.expected_participants,
      })
      .from(seasonPlanEntries)
      .where(eq(seasonPlanEntries.season_id, previousSeasonId));

    for (const entry of entries) {
      if (!entry.group_id) continue;
      const participants = (entry.expected_participants as string[] | null) ?? [];
      for (const memberId of participants) {
        if (!result.has(memberId)) result.set(memberId, entry.group_id);
      }
    }
    return result;
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

    // Build a member-by-id lookup once, re-used for the second pass and other hot paths.
    const membersById = new Map<string, (typeof members)[number]>();
    for (const m of members) membersById.set(m.id, m);

    // Sort members: priority to waitlist-carryovers, then high attendance, then by experience
    const sortedMembers = sortMembersByPriority(members);

    // Split members into kids and adults, then by skill level
    const kids = sortedMembers.filter((m) => m.isMinor);
    const adults = sortedMembers.filter((m) => !m.isMinor);

    // Kinder zuerst (kleinere Gruppen, engeres Zeitfenster) — die Multi-Start-
    // Variante `adultsFirst` dreht das um, weil die zuerst verplante Kohorte die
    // besten Trainer und Plätze bekommt.
    const [firstCohort, firstAge, secondCohort, secondAge] = this.variant.adultsFirst
      ? ([adults, 'adult', kids, 'kids'] as const)
      : ([kids, 'kids', adults, 'adult'] as const);

    let _groupIndex = await this.assignMembersToGroups(
      firstCohort,
      firstAge,
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

    _groupIndex = await this.assignMembersToGroups(
      secondCohort,
      secondAge,
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
    // Improved: also verify member time-slot availability and wish-partner fulfillment
    // so admins see fewer "wrong-time" placements in the plan-edit step.
    const stillUnassigned = sortedMembers.filter((m) => !assignedMemberIds.has(m.id));
    const DAY_NAMES_LOCAL = DAY_NAMES;
    if (stillUnassigned.length > 0) {
      for (const member of stillUnassigned) {
        const effectiveLevel = member.promotedLevel || member.skillLevel;
        const memberAgeGroup = member.isMinor ? 'kids' : 'adult';
        const maxSize = member.isMinor ? this.config.kidsGroupMaxSize : this.config.groupMaxSize;
        const avoidSet = new Set(member.avoidMemberIds);

        // Try to find an existing group with space, matching level/age, and no avoid-conflicts
        let placed = false;
        for (const assignment of assignments) {
          // Capacity check — Q2-Audit (Punkt 11): respektiert eine individuelle
          // Gruppen-Kapazität (groups.max_size) statt immer den globalen Default.
          const groupInfo = candidateGroups.get(assignment.groupId);
          const effectiveMaxSize = groupInfo?.maxSize ?? maxSize;
          if (assignment.memberIds.length >= effectiveMaxSize) continue;

          // Level compatibility: within configured niveau step tolerance
          if (groupInfo) {
            const levelDiff = Math.abs(
              LEVEL_RANK[effectiveLevel] - LEVEL_RANK[groupInfo.level as SkillLevel]
            );
            if (levelDiff > this.config.maxNiveauLevelSteps) continue;
          }

          // Age-group compatibility: must match the group's age group
          if (groupInfo && groupInfo.ageGroup && groupInfo.ageGroup !== memberAgeGroup) continue;

          // TIME-SLOT CHECK: member must be available for this group's slot
          // (was previously a known gap — see Optimization #4)
          const dayName = DAY_NAMES_LOCAL[assignment.dayOfWeek];
          const daySlots = member.availability[dayName] || [];
          const memberAvailable = daySlots.some(
            (s) => s.start <= assignment.startTime && s.end >= assignment.endTime
          );
          if (!memberAvailable) continue;

          // Avoid conflicts: member avoids any existing group member (O(1) Set lookup)
          if (avoidSet.size > 0) {
            const hasConflict = assignment.memberIds.some((mid) => avoidSet.has(mid));
            if (hasConflict) continue;
          }

          // Avoid conflicts: any existing group member avoids this member.
          // Build a single-pass index instead of a per-assignment O(n²) scan.
          const groupMemberAvoids =
            member.avoidMemberIds.length > 0
              ? assignment.memberIds.some((mid) => {
                  const other = membersById.get(mid);
                  return !!other && other.avoidMemberIds.includes(member.id);
                })
              : false;
          if (groupMemberAvoids) continue;

          // Place member in this group
          assignment.memberIds.push(member.id);
          assignment.memberDetails.push({
            memberId: member.id,
            memberName: member.name,
            niveauMatch: -1, // -1 = not computed (second-pass placement)
            experienceMonths: member.experienceMonths,
            groupExperienceSpan: '—',
            wishPartnerFulfilled: member.wishPartnerIds.some((wpid) =>
              assignment.memberIds.includes(wpid)
            ),
            wishPartnerNames: member.wishPartnerIds
              .filter((wpid) => assignment.memberIds.includes(wpid))
              .map((wpid) => membersById.get(wpid)?.name || 'Unbekannt'),
            isPromoted: !!member.promotedLevel,
            assignmentReason: 'Nachträglich zugewiesen (zweite Runde, Slot verifiziert)',
          });
          assignedMemberIds.add(member.id);
          member._unassignedReason = undefined;
          placed = true;
          break;
        }

        if (!placed) {
          member._unassignedReason =
            member._unassignedReason ||
            `Keine passende Gruppe mit Kapazität + Slot-Verfügbarkeit (${memberAgeGroup}, ${effectiveLevel})`;
        }
      }
    }

    const unassigned = sortedMembers.filter((m) => !assignedMemberIds.has(m.id));

    // BACKTRACKING (Optimization #6 + Sprint 4 P0 #3 Adaptive Backtrack):
    // First pass: depth=3 (cap 3 retries) — the proven Sprint 3 default.
    // Second pass: depth=5 (cap 2 retries) — runs ONLY if the unassigned rate
    // after the first pass is still above `unassignedRateThreshold` (default 5%).
    // The two-pass design bounds total work to at most 5 victim-pops per member
    // while giving the algorithm more freedom to re-slot when many members remain
    // unassigned. Expected impact: Unassigned @ 2000m 7 → ~2 (-71%) per
    // docs/SCALING_ANALYSIS.md (Opt #3).
    if (unassigned.length > 0 && this.config.backtrackDepth > 0 && assignments.length > 0) {
      await this.backtrackForUnassigned(
        unassigned,
        sortedMembers,
        membersById,
        members,
        trainers,
        courts,
        candidateGroups,
        slotFailureRates,
        timeSlots,
        trainerSessionCount,
        courtTimeSlotUsage,
        assignments,
        assignedMemberIds,
        3, // first pass: maxRetries = 3, depth = 3
        3 // first pass: explicit depth = 3 (independent of maxRetries now)
      );

      // Recompute unassigned rate after first pass to decide whether to escalate.
      const stillUnassignedAfterPass1 = sortedMembers.filter((m) => !assignedMemberIds.has(m.id));
      const unassignedRate =
        members.length > 0 ? stillUnassignedAfterPass1.length / members.length : 0;
      if (
        stillUnassignedAfterPass1.length > 0 &&
        unassignedRate > this.config.unassignedRateThreshold &&
        this.config.backtrackDepth > 0 &&
        assignments.length > 0
      ) {
        await this.backtrackForUnassigned(
          stillUnassignedAfterPass1,
          sortedMembers,
          membersById,
          members,
          trainers,
          courts,
          candidateGroups,
          slotFailureRates,
          timeSlots,
          trainerSessionCount,
          courtTimeSlotUsage,
          assignments,
          assignedMemberIds,
          2, // second pass: maxRetries = 2 (bounds total loops)
          5 // second pass: depth = 5 (deeper re-slotting, matches doc-spec)
        );
      }
    }
    // Bugfix (Q2-Audit): max_sessions_per_week (Mitglieder wollen z.B. 2x/Woche
    // trainieren) wurde aus der DB geladen, aber vom Engine komplett ignoriert —
    // jedes Mitglied bekam immer genau 1 Slot/Woche. Additiver Pass NACH allen
    // Haupt-/Zweit-/Backtracking-Durchläufen: versucht, bereits zugewiesenen
    // Mitgliedern mit Wunsch > 1 weitere, zeitlich nicht überlappende Sessions
    // in bestehenden Gruppen mit Kapazität zuzuweisen. Rein additiv — verändert
    // keine bestehende Zuweisung, daher risikoarm gegenüber dem Rest der Pipeline.
    this.assignExtraSessions(members, candidateGroups, assignments, membersById);

    const finalUnassigned = sortedMembers.filter((m) => !assignedMemberIds.has(m.id));
    return { assignments, unassigned: finalUnassigned };
  }

  /**
   * Additive pass for `maxSessionsPerWeek > 1`: places already-assigned members
   * into further groups (existing assignments with capacity, matching level/age,
   * no time overlap with the member's current sessions, no avoid-conflicts) until
   * their desired weekly session count is met or no compatible slot remains.
   * Members who weren't placed at all in the main pass are untouched here — that
   * remains the job of the unassigned/backtracking passes.
   */
  private assignExtraSessions(
    members: (MemberWithDetails & { _unassignedReason?: string })[],
    candidateGroups: Map<string, GroupInfo>,
    assignments: GroupAssignment[],
    membersById: Map<string, MemberWithDetails & { _unassignedReason?: string }>
  ): void {
    const sessionCount = new Map<string, number>();
    for (const a of assignments) {
      for (const mid of a.memberIds) sessionCount.set(mid, (sessionCount.get(mid) || 0) + 1);
    }

    for (const member of members) {
      const desired = member.maxSessionsPerWeek || 1;
      let current = sessionCount.get(member.id) || 0;
      if (current === 0 || current >= desired) continue;

      const ageGroup = member.isMinor ? 'kids' : 'adult';
      const maxSize = member.isMinor ? this.config.kidsGroupMaxSize : this.config.groupMaxSize;
      const effectiveLevel = member.promotedLevel || member.skillLevel;

      while (current < desired) {
        const memberSlots = assignments.filter((a) => a.memberIds.includes(member.id));
        const candidate = assignments.find((a) => {
          if (a.memberIds.includes(member.id)) return false;
          // Q2-Audit (Punkt 11): individuelle Gruppen-Kapazität respektieren.
          const groupInfo = candidateGroups.get(a.groupId);
          if (a.memberIds.length >= (groupInfo?.maxSize ?? maxSize)) return false;

          if (groupInfo) {
            const levelDiff = Math.abs(
              LEVEL_RANK[effectiveLevel] - LEVEL_RANK[groupInfo.level as SkillLevel]
            );
            if (levelDiff > this.config.maxNiveauLevelSteps) return false;
            if (groupInfo.ageGroup && groupInfo.ageGroup !== ageGroup) return false;
          }

          const overlapsExisting = memberSlots.some(
            (ms) =>
              ms.dayOfWeek === a.dayOfWeek &&
              this.timeSlotsOverlap(ms.startTime, ms.endTime, a.startTime, a.endTime)
          );
          if (overlapsExisting) return false;

          if (
            !this.isMemberSlotAvailable(member.id, a.dayOfWeek, {
              start: a.startTime,
              end: a.endTime,
            })
          )
            return false;

          if (member.avoidMemberIds.some((id) => a.memberIds.includes(id))) return false;
          if (a.memberIds.some((mid) => membersById.get(mid)?.avoidMemberIds.includes(member.id)))
            return false;

          return true;
        });

        if (!candidate) break; // kein passender freier Slot mehr — kein Fehler, nur Ende dieses Passes

        current++;
        candidate.memberIds.push(member.id);
        candidate.memberDetails.push({
          memberId: member.id,
          memberName: member.name,
          niveauMatch: this.computeNiveauMatch(
            member,
            candidate.memberIds
              .map((mid) => membersById.get(mid))
              .filter((m): m is MemberWithDetails & { _unassignedReason?: string } => !!m)
          ),
          experienceMonths: member.experienceMonths,
          groupExperienceSpan: '—',
          wishPartnerFulfilled: false,
          wishPartnerNames: [],
          isPromoted: !!member.promotedLevel,
          assignmentReason: `Zusätzliche Session (Wunsch: ${desired}x/Woche, dies ist Session ${current})`,
        });
        sessionCount.set(member.id, current);
      }
    }
  }

  /**
   * Backtracking optimizer: undo the last N group assignments, then re-evaluate them
   * with the dual goal of (a) re-placing the undone groups in alternative slots and
   * (b) freeing up the original slots for previously-unassigned members.
   *
   * Depth-first: tries the most recent group first. Max 3 retries (overrides `backtrackDepth`
   * if larger) to bound worst-case runtime.
   */
  private async backtrackForUnassigned(
    initialUnassigned: (MemberWithDetails & { _unassignedReason?: string })[],
    _sortedMembers: (MemberWithDetails & { _unassignedReason?: string })[],
    _membersById: Map<string, MemberWithDetails & { _unassignedReason?: string }>,
    allMembers: (MemberWithDetails & { _unassignedReason?: string })[],
    trainers: TrainerWithDetails[],
    courts: CourtInfo[],
    _candidateGroups: Map<string, GroupInfo>,
    slotFailureRates: Record<string, number>,
    timeSlots: Array<{ start: string; end: string }>,
    trainerSessionCount: Map<string, number>,
    courtTimeSlotUsage: Map<string, Set<string>>,
    assignments: GroupAssignment[],
    assignedMemberIds: Set<string>,
    maxRetries: number = 3,
    depthOverride?: number
  ): Promise<void> {
    // Sprint 4 P0 #3: depth is now independent of maxRetries so the adaptive
    // second pass can use depth=5 with only maxRetries=2 (bounds total work
    // while allowing deeper re-slotting). The original code coupled them via
    // `Math.min(backtrackDepth, maxRetries, ...)`, which capped depth at
    // maxRetries — a leftover from the original 3-retry design.
    const depth = Math.min(
      this.config.backtrackDepth,
      depthOverride ?? maxRetries,
      assignments.length
    );

    // Sprint 4 refactor: build a member id -> member map once to replace the per-victim
    // `allMembers.find(m => m.id === ...)` O(members) scans that previously ran for
    // each freed victim. Was: 2× O(members) per victim in the worst case.
    const allMembersById = new Map<string, MemberWithDetails & { _unassignedReason?: string }>();
    for (const m of allMembers) allMembersById.set(m.id, m);

    let stillUnassigned = initialUnassigned;
    let retryCount = 0;

    while (retryCount < maxRetries && stillUnassigned.length > 0 && assignments.length > 0) {
      retryCount++;

      // Take the last `depth` groups (the "victims" we might need to re-slot)
      const victimCount = Math.min(depth, assignments.length);
      const victims = assignments.splice(assignments.length - victimCount, victimCount);

      // Free up the resources each victim group consumed
      for (const v of victims) {
        // Decrement trainer session count
        const currentCount = trainerSessionCount.get(v.trainerId) || 0;
        trainerSessionCount.set(v.trainerId, Math.max(0, currentCount - 1));
        // Remove member assignments
        for (const mid of v.memberIds) assignedMemberIds.delete(mid);
        // Free up court usage
        if (v.courtId) {
          const courtKey = `${v.dayOfWeek}_${v.startTime}`;
          const usage = courtTimeSlotUsage.get(v.courtId);
          if (usage) usage.delete(courtKey);
        }
      }

      // Also re-add the victim members to the "unassigned" pool for this retry
      const freedMembers: (MemberWithDetails & { _unassignedReason?: string })[] = [];
      for (const v of victims) {
        for (const detail of v.memberDetails) {
          // Pull the full member object via pre-built id index (Sprint 4 refactor:
          // was O(members) per victim via Array.find, now O(1) Map.get).
          const fullMember = allMembersById.get(detail.memberId);
          if (fullMember) {
            fullMember._unassignedReason = undefined;
            freedMembers.push(fullMember);
          }
        }
      }

      // The "unassigned pool" for this retry: previous unassigned + freed members
      const unassignedPool = [...stillUnassigned, ...freedMembers];

      // Try to re-place victims in alternative slots (excluding the slot they just vacated)
      const rePlaced: GroupAssignment[] = [];
      for (const v of victims) {
        const victimMemberDetails = v.memberDetails;
        const victimMembers = victimMemberDetails
          .map((d) => allMembersById.get(d.memberId))
          .filter((m): m is NonNullable<typeof m> => m !== undefined);
        if (victimMembers.length === 0) continue;
        // Find a new slot, excluding the original slot
        const excludeDayTime = { day: v.dayOfWeek, start: v.startTime };
        const newSlot = this.findBestTimeSlot(
          victimMembers,
          trainers,
          courts,
          trainerSessionCount,
          courtTimeSlotUsage,
          slotFailureRates,
          [...assignments, ...rePlaced], // treat re-placed as already-committed
          timeSlots
        );

        // If new slot is found AND is different from the original, use it
        if (
          newSlot &&
          (newSlot.dayOfWeek !== excludeDayTime.day || newSlot.startTime !== excludeDayTime.start)
        ) {
          // Re-add the victim group at the new slot
          const rePlacedGroup: GroupAssignment = {
            ...v,
            trainerId: newSlot.trainerId,
            trainerName: newSlot.trainerName,
            dayOfWeek: newSlot.dayOfWeek,
            startTime: newSlot.startTime,
            endTime: newSlot.endTime,
            courtId: newSlot.courtId,
            courtName: newSlot.courtName,
          };
          rePlaced.push(rePlacedGroup);
          // Update trainer + court usage for the new slot
          const newCount = trainerSessionCount.get(newSlot.trainerId) || 0;
          trainerSessionCount.set(newSlot.trainerId, newCount + 1);
          if (newSlot.courtId) {
            const newCourtKey = `${newSlot.dayOfWeek}_${newSlot.startTime}`;
            const newUsage = courtTimeSlotUsage.get(newSlot.courtId) || new Set();
            newUsage.add(newCourtKey);
            courtTimeSlotUsage.set(newSlot.courtId, newUsage);
          }
          // Re-mark victim members as assigned
          for (const mid of v.memberIds) assignedMemberIds.add(mid);
        }
        // If no new slot, the victim members stay in `unassignedPool` and will be retried
      }

      // Commit the re-placed groups back into assignments
      assignments.push(...rePlaced);

      // Now try to place the still-unassigned members into the freed-up original slots
      // of any victims that were NOT successfully re-placed
      const freedOriginalSlots: Array<{
        day: number;
        start: string;
        end: string;
        courtId: string | null;
        trainerId: string;
        trainerName: string;
      }> = [];
      for (const v of victims) {
        const wasReplaced = rePlaced.some(
          (r) =>
            r.groupId === v.groupId && (r.dayOfWeek !== v.dayOfWeek || r.startTime !== v.startTime)
        );
        if (!wasReplaced) {
          freedOriginalSlots.push({
            day: v.dayOfWeek,
            start: v.startTime,
            end: v.endTime,
            courtId: v.courtId,
            trainerId: v.trainerId,
            trainerName: v.trainerName,
          });
        }
      }

      // For each unassigned member, try to fit them into a freed original slot
      const newlyPlaced: string[] = [];
      for (const member of unassignedPool) {
        if (assignedMemberIds.has(member.id)) continue;

        for (const slot of freedOriginalSlots) {
          // Check member availability for this slot
          const dayName = DAY_NAMES[slot.day];
          const daySlots = member.availability[dayName] || [];
          const available = daySlots.some((s) => s.start <= slot.start && s.end >= slot.end);
          if (!available) continue;

          // Capacity check: 1 per slot (we're creating a single-member group)
          // Avoid conflicts: check against the other victim members that are still unassigned
          const otherFreed = unassignedPool.filter(
            (m) => m.id !== member.id && !assignedMemberIds.has(m.id)
          );
          const hasAvoid = member.avoidMemberIds.some((id) => otherFreed.some((o) => o.id === id));
          if (hasAvoid) continue;

          // Place the member in a new ghost group at the freed slot
          const ghostAssignment: GroupAssignment = {
            groupId: `backtrack-${retryCount}-${member.id}`,
            groupName: `Backtrack Retry ${retryCount} - ${member.name}`,
            trainerId: slot.trainerId,
            trainerName: slot.trainerName,
            dayOfWeek: slot.day as DayOfWeek,
            startTime: slot.start,
            endTime: slot.end,
            courtId: slot.courtId,
            courtName:
              victims.find((v) => v.dayOfWeek === slot.day && v.startTime === slot.start)
                ?.courtName ?? null,
            maxSize: 1,
            memberIds: [member.id],
            memberDetails: [
              {
                memberId: member.id,
                memberName: member.name,
                niveauMatch: -1,
                experienceMonths: member.experienceMonths,
                groupExperienceSpan: '—',
                wishPartnerFulfilled: false,
                wishPartnerNames: [],
                isPromoted: !!member.promotedLevel,
                assignmentReason: `Backtracking-Retry ${retryCount} (freier Slot nach Re-Slotting)`,
              },
            ],
            waitlistIds: [],
            waitlistDetails: [],
            warnings: ['Backtracking-Einzelzuweisung - bitte manuell prüfen'],
            conflictIds: [],
          };
          assignments.push(ghostAssignment);
          assignedMemberIds.add(member.id);
          // Update trainer session count for the freed slot
          const tc = trainerSessionCount.get(slot.trainerId) || 0;
          trainerSessionCount.set(slot.trainerId, tc + 1);
          if (slot.courtId) {
            const ck = `${slot.day}_${slot.start}`;
            const cu = courtTimeSlotUsage.get(slot.courtId) || new Set();
            cu.add(ck);
            courtTimeSlotUsage.set(slot.courtId, cu);
          }
          // Consume this slot so no other unassigned member takes it
          freedOriginalSlots.splice(freedOriginalSlots.indexOf(slot), 1);
          newlyPlaced.push(member.id);
          break;
        }
      }

      // If no progress was made in this retry, break to avoid infinite loop
      if (newlyPlaced.length === 0 && rePlaced.length === 0) {
        // Restore victims to assignments so we don't lose their data permanently
        // (they will be marked unassigned, but at least the data is preserved)
        for (const v of victims) {
          for (const mid of v.memberIds) assignedMemberIds.add(mid);
        }
        assignments.push(...victims);
        break;
      }

      // Update stillUnassigned for next retry
      stillUnassigned = unassignedPool.filter((m) => !assignedMemberIds.has(m.id));
    }
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

    // ponytail: sort-and-slice — pragmatic grouping, avoids strict level buckets leaving
    // members unassigned when there aren't enough at each level to fill a group.
    // Bugfix (Q2-Audit / structural): sort key extended beyond niveau+experience with
    // affinity (wish partners + previous-season continuity) and availability, so slicing
    // naturally clusters compatible members instead of mixing incompatible schedules/
    // separating friends by coincidence of sort order. Priority (member-set Wichtigkeit,
    // 1-5) breaks remaining ties so higher-priority members are less likely to end up
    // on the waitlist.
    const affinity = this.variant.useAffinity
      ? this.computeAffinityGroups(cohort)
      : new Map<string, number>();
    const sorted = [...cohort].sort((a, b) => {
      const aRank = LEVEL_RANK[a.promotedLevel || a.skillLevel];
      const bRank = LEVEL_RANK[b.promotedLevel || b.skillLevel];
      if (aRank !== bRank) return aRank - bRank;
      const aAff = affinity.get(a.id) ?? 0;
      const bAff = affinity.get(b.id) ?? 0;
      if (aAff !== bAff) return aAff - bAff;
      const aAvail = this.availabilityBitmask(a);
      const bAvail = this.availabilityBitmask(b);
      if (aAvail !== bAvail) return aAvail - bAvail;
      const aPrio = a.priority ?? 5;
      const bPrio = b.priority ?? 5;
      if (aPrio !== bPrio) return bPrio - aPrio;
      return a.experienceMonths - b.experienceMonths;
    });

    // Build avoid-member map
    const avoidMap = new Map<string, Set<string>>();
    for (const m of sorted) {
      if (m.avoidMemberIds.length > 0) avoidMap.set(m.id, new Set(m.avoidMemberIds));
    }

    let groupIndex = startGroupIndex;

    // Slices bilden: höchstens `maxSize` Mitglieder UND höchstens
    // `maxNiveauLevelSteps` Niveau-Stufen Spanne.
    // Vorher wurde stur alle `maxSize` Mitglieder geschnitten. Weil `sorted`
    // nach Niveau aufsteigt, fiel ein Schnitt regelmäßig mitten in einen
    // Niveau-Sprung: bei TC Rheinland landeten Mittel und Profi in derselben
    // Gruppe (Spanne 2, erlaubt 1) — die Konfliktprüfung meldete das hinterher
    // als `large_niveau_span`, obwohl der Algorithmus die Grenze kennt und im
    // zweiten Durchlauf sogar prüft. Der Schnitt an der Niveau-Grenze
    // zersplittert die Gruppen nicht: er greift nur dort, wo ohnehin ein Sprung
    // von mehr als einer Stufe liegt.
    // Erst Läufe bilden, die nur an echten Niveau-Sprüngen getrennt werden ...
    const runs: (typeof sorted)[] = [];
    {
      let current: typeof sorted = [];
      let minRank = Infinity;
      let maxRank = -Infinity;
      for (const m of sorted) {
        const rank = LEVEL_RANK[m.promotedLevel || m.skillLevel];
        const spanWithMember = Math.max(maxRank, rank) - Math.min(minRank, rank);
        if (current.length > 0 && spanWithMember > this.config.maxNiveauLevelSteps) {
          runs.push(current);
          current = [];
          minRank = Infinity;
          maxRank = -Infinity;
        }
        current.push(m);
        minRank = Math.min(minRank, rank);
        maxRank = Math.max(maxRank, rank);
      }
      if (current.length > 0) runs.push(current);
    }

    // ... und diese Läufe dann gleichmäßig aufteilen. Vorher wurde stur alle
    // `maxSize` Mitglieder geschnitten: 7 Erwachsene bei maxSize 6 ergaben eine
    // Sechsergruppe plus ein "Einzeltraining". Jetzt entstehen bei 7 Mitgliedern
    // zwei Gruppen zu 4 und 3.
    const slices: (typeof sorted)[] = [];
    for (const run of runs) {
      let offset = 0;
      for (const size of balancedSliceSizes(run.length, maxSize)) {
        slices.push(run.slice(offset, offset + size));
        offset += size;
      }
    }
    const numGroups = slices.length;

    for (const slice of slices) {
      // Filter out avoid-member conflicts from this slice
      const filteredSlice = slice.filter((m) => {
        const enemies = avoidMap.get(m.id);
        if (!enemies || enemies.size === 0) return true;
        return !slice.some((other) => other.id !== m.id && enemies.has(other.id));
      });

      if (filteredSlice.length < minSize && numGroups > 1) {
        for (const m of slice) {
          if (!filteredSlice.includes(m) && !assignedMemberIds.has(m.id)) {
            if (!m._unassignedReason)
              m._unassignedReason = `Avoid-Konflikt (${ageGroup}) — wird in zweiter Runde neu zugewiesen`;
          }
        }
        continue;
      }

      // Modal level = most common level in this slice
      const levelCounts: Record<SkillLevel, number> = {
        beginner: 0,
        intermediate: 0,
        advanced: 0,
        professional: 0,
      };
      for (const m of filteredSlice) levelCounts[m.promotedLevel || m.skillLevel]++;
      const skillLevel = (Object.entries(levelCounts) as [SkillLevel, number][]).sort(
        ([, a], [, b]) => b - a
      )[0][0];

      const levelRanks = filteredSlice.map((m) => LEVEL_RANK[m.promotedLevel || m.skillLevel]);
      const levelSpan = Math.max(...levelRanks) - Math.min(...levelRanks);

      // Fix 4: Team/Leistungsgruppen bekommen Doppelstunden (120 min consecutive block)
      const isTeamGroup =
        (ageGroup === 'kids' && skillLevel === 'advanced') || // U18 Mannschaft
        (!this.config.teamLevels.length
          ? false
          : (this.config.teamLevels as string[]).includes(skillLevel) && ageGroup !== 'kids');
      const slotDuration = isTeamGroup
        ? this.config.teamSlotMinutes
        : this.config.slotDurationMinutes;
      const groupTimeSlots =
        slotDuration !== this.config.slotDurationMinutes
          ? buildStandardTimeSlots(slotDuration, 22)
          : timeSlots;

      // Find best time slot
      const bestSlot = this.findBestTimeSlot(
        filteredSlice,
        trainers,
        courts,
        trainerSessionCount,
        courtTimeSlotUsage,
        slotFailureRates,
        assignments,
        groupTimeSlots
      );

      if (!bestSlot) {
        for (const m of filteredSlice) {
          if (!assignedMemberIds.has(m.id))
            m._unassignedReason = `Kein verfügbarer Zeitslot mit Trainer (${ageGroup})`;
        }
        continue;
      }

      // Select matching group or create placeholder in DB
      // Eine bereits verplante Gruppe darf nicht ein zweites Mal gewählt werden: die
      // Modulo-Zuweisung unten vergab sonst bei mehr Slices als passenden Gruppen
      // dieselbe groups.id mehrfach. Zwei Plan-Einträge mit identischer ID sind im
      // Wizard nicht mehr auseinanderzuhalten (Drag & Drop verschob beide zugleich,
      // Mitglieder-Umzüge trafen beide) — stattdessen wird unten eine neue angelegt.
      const usedGroupIds = new Set(assignments.map((a) => a.groupId));
      const allMatching = Array.from(candidateGroups.values()).filter(
        (g) =>
          g.level === skillLevel &&
          (!g.ageGroup || g.ageGroup === ageGroup) &&
          !usedGroupIds.has(g.id)
      );
      // Bugfix (Q2-Audit): preferred_group_ids wurde geladen, aber nie ausgewertet —
      // die Modulo-Zuweisung gewann immer. Jetzt bekommt eine Gruppe Vorrang, die von
      // mindestens einem Mitglied der Slice explizit gewünscht wurde.
      // Zweite Priorität: die Gruppe, in der die meisten dieser Slice letzte
      // Saison saßen. `previousGroupId` war geladen, aber ungenutzt — es gewann
      // immer die willkürliche Modulo-Zuweisung, was Gruppen jede Saison neu
      // durchmischte und Gruppennamen sinnlos machte.
      const prevGroupCounts = new Map<string, number>();
      for (const m of filteredSlice) {
        if (m.previousGroupId)
          prevGroupCounts.set(m.previousGroupId, (prevGroupCounts.get(m.previousGroupId) ?? 0) + 1);
      }
      const byContinuity = allMatching
        .filter((g) => prevGroupCounts.has(g.id))
        .sort((a, b) => (prevGroupCounts.get(b.id) ?? 0) - (prevGroupCounts.get(a.id) ?? 0))[0];

      const existingGroup =
        allMatching.find((g) => filteredSlice.some((m) => m.preferredGroupIds.includes(g.id))) ||
        byContinuity ||
        allMatching[groupIndex % Math.max(1, allMatching.length)];
      const prefix = ageGroup === 'kids' ? 'Kids' : LEVEL_LABEL[skillLevel];
      let group: GroupInfo;
      if (existingGroup) {
        group = existingGroup;
      } else {
        // Q2-Audit (Punkt 11): eine neu entstehende Solo-Slice (1 Mitglied — sei es
        // gewollt oder ein Rest-aus-der-Teilung) IST für Abrechnung/Kalender ein
        // Einzeltraining, kein "Gruppe mit 1 Person". Entsprechend benannt; die
        // eigentliche Klassifizierung passiert in saveToDatabase() über
        // memberIds.length === 1 (deckt auch Second-Pass/Backtracking-Fälle ab).
        const groupName =
          filteredSlice.length === 1
            ? `Einzeltraining ${prefix} — ${filteredSlice[0].name}`
            : `${prefix} Gruppe ${groupIndex + 1}`;
        // Platzhalter statt INSERT: die Zeile entsteht erst in `saveToDatabase`.
        // Vorher legte jeder Rechenlauf Gruppen an — auch der Dry Run, den der
        // Wizard bei jedem "Neu berechnen" auslöst, und (seit Multi-Start) jede
        // verworfene Variante.
        const placeholderId = `${PLACEHOLDER_GROUP_PREFIX}${randomUUID()}`;
        this.pendingGroups.set(placeholderId, {
          name: groupName,
          level: skillLevel,
          ageGroup,
        });
        group = {
          id: placeholderId,
          name: groupName,
          level: skillLevel,
          ageGroup,
        };
      }

      groupIndex++;

      // Q2-Audit (Punkt 11): individuelle Gruppen-Kapazität respektieren — bestehende
      // Gruppen können in `groups.max_size` eine von groupMaxSize/kidsGroupMaxSize
      // abweichende Kapazität haben. Ist die Slice größer, wird sie hier gekürzt;
      // die überzähligen Mitglieder gehen (wie bei Avoid-Konflikten) in den Second-Pass.
      const effectiveMaxSize = group.maxSize ?? maxSize;
      // Snapshot BEFORE the capacity-trim splice so the avoid-conflict removedCount
      // warning below doesn't conflate the two different reasons for removal.
      const preCapacityTrimLength = filteredSlice.length;
      const capacityOverflow =
        filteredSlice.length > effectiveMaxSize ? filteredSlice.splice(effectiveMaxSize) : [];
      for (const m of capacityOverflow) {
        if (!assignedMemberIds.has(m.id) && !m._unassignedReason) {
          m._unassignedReason = `Gruppe "${group.name}" hat begrenzte Kapazität (${effectiveMaxSize}) — wird in zweiter Runde neu zugewiesen`;
        }
      }

      // Der Zeitslot wurde anhand der Verfügbarkeit eines TEILS der Gruppe gewählt
      // (findBestTimeSlot filtert dort auf verfügbare Mitglieder). Übrig blieben
      // bisher trotzdem alle Mitglieder der Slice — wer zu dieser Zeit ausdrücklich
      // nicht kann, wurde also eingeplant. Die Konfliktprüfung meldet das
      // anschließend als `member_unavailable`, da steht der Plan aber schon.
      // Sie gehen denselben Weg wie Kapazitäts- und Avoid-Überhänge: zweite Runde.
      const slotWindow = { start: bestSlot.startTime, end: bestSlot.endTime };
      const unavailableForSlot: typeof filteredSlice = [];
      for (let i = filteredSlice.length - 1; i >= 0; i--) {
        const m = filteredSlice[i];
        if (!this.isMemberSlotAvailable(m.id, bestSlot.dayOfWeek, slotWindow)) {
          unavailableForSlot.push(...filteredSlice.splice(i, 1));
        }
      }
      for (const m of unavailableForSlot) {
        if (!assignedMemberIds.has(m.id) && !m._unassignedReason) {
          m._unassignedReason = `Zu ${DAY_LABELS[bestSlot.dayOfWeek]} ${bestSlot.startTime} laut eigener Angabe nicht verfügbar — wird in zweiter Runde neu zugewiesen`;
        }
      }

      // Calculate experience span for display
      const experiences = filteredSlice.map((m) => m.experienceMonths);
      const minExp = Math.min(...experiences);
      const maxExp = Math.max(...experiences);

      const warnings: string[] = [];
      if (levelSpan > this.config.maxNiveauLevelSteps) {
        const effectiveLevels = filteredSlice.map((m) => m.promotedLevel || m.skillLevel);
        const minL =
          LEVEL_LABEL[effectiveLevels.reduce((a, b) => (LEVEL_RANK[a] < LEVEL_RANK[b] ? a : b))];
        const maxL =
          LEVEL_LABEL[effectiveLevels.reduce((a, b) => (LEVEL_RANK[a] > LEVEL_RANK[b] ? a : b))];
        warnings.push(
          `Niveau-Spanne: ${minL}–${maxL} (${levelSpan} Stufen, Max. ${this.config.maxNiveauLevelSteps})`
        );
      }

      // `maxNiveauSpanBeginner/-Advanced` (Erfahrungs-Spanne in Monaten) wurden aus
      // der DB gelesen und nirgends ausgewertet. Als harte Schnittgrenze würden sie
      // Gruppen zersplittern (Anfänger streuen real 0–12 Monate), als sichtbare
      // Warnung geben sie dem Admin genau die Information, für die die Stellschraube
      // gedacht war: Diese Gruppe ist fachlich weiter auseinander als gewollt.
      const expSpanLimit =
        LEVEL_RANK[skillLevel] >= LEVEL_RANK.advanced
          ? this.config.maxNiveauSpanAdvanced
          : this.config.maxNiveauSpanBeginner;
      if (maxExp - minExp > expSpanLimit) {
        warnings.push(
          `Erfahrungs-Spanne: ${maxExp - minExp} Monate (Max. ${expSpanLimit} für ${LEVEL_LABEL[skillLevel]})`
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
      const removedCount = slice.length - preCapacityTrimLength;
      if (removedCount > 0) {
        warnings.push(
          `${removedCount} Mitglieder wegen Avoid-Konflikten aus dieser Gruppe entfernt`
        );
      }
      if (capacityOverflow.length > 0) {
        warnings.push(
          `${capacityOverflow.length} Mitglieder wegen begrenzter Gruppenkapazität (${effectiveMaxSize}) in zweiter Runde neu zugewiesen`
        );
      }

      trainerSessionCount.set(
        bestSlot.trainerId,
        (trainerSessionCount.get(bestSlot.trainerId) || 0) + 1
      );
      const courtKey = `${bestSlot.dayOfWeek}_${bestSlot.startTime}`;
      const courtUsage = courtTimeSlotUsage.get(bestSlot.courtId || '') || new Set<string>();
      courtUsage.add(courtKey);
      courtTimeSlotUsage.set(bestSlot.courtId || '', courtUsage);

      const memberDetails = filteredSlice.map((m) => {
        const fulfilledWishes = m.wishPartnerIds.filter((wpid) =>
          filteredSlice.some((sm) => sm.id === wpid)
        );
        return {
          memberId: m.id,
          memberName: m.name,
          niveauMatch: this.computeNiveauMatch(m, filteredSlice),
          experienceMonths: m.experienceMonths,
          groupExperienceSpan: `${minExp}-${maxExp} Monate`,
          wishPartnerFulfilled: fulfilledWishes.length > 0,
          wishPartnerNames: fulfilledWishes.map(
            (wpid) => filteredSlice.find((sm) => sm.id === wpid)?.name || 'Unbekannt'
          ),
          isPromoted: !!m.promotedLevel,
          assignmentReason: this.buildAssignmentReason(m, bestSlot!, fulfilledWishes),
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
        maxSize: effectiveMaxSize,
        memberIds: filteredSlice.map((m) => m.id),
        memberDetails,
        waitlistIds: [],
        waitlistDetails: [],
        warnings,
        conflictIds: [],
      });

      for (const m of filteredSlice) assignedMemberIds.add(m.id);
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
    // Sprint 4 follow-up: stash the call's member/trainer lists into the
    // fallback fields so the slot-check helpers (`isMemberSlotAvailable` /
    // `isTrainerSlotAvailable`) can do a linear search when the pre-computed
    // Map cache is null — this is the path taken by direct callers such as
    // unit tests that call `findBestTimeSlot` without going through
    // `runClustering`. Production callers are unaffected because the Map
    // cache is always populated first and is preferred over the fallback.
    this._cachedMembersForSlotCheck = members;
    this._cachedTrainersForSlotCheck = trainers;

    let bestScore = -Infinity;
    let bestResult:
      | (TimeSlotInfo & {
          trainerId: string;
          trainerName: string;
          courtId: string | null;
          courtName: string | null;
        })
      | null = null;

    const groupHasMinors = members.some((m) => m.isMinor);

    // Sonntag ist standardmäßig kein Trainingstag (Vereinsrealität — spielfrei/Turniertag —
    // sowie Arbeits-/Ruhezeitregeln für Trainer). Mo(0)-Sa(5) per Default, So(6) nur wenn
    // im Wizard bewusst per Checkbox aktiviert (config.includeSunday).
    const lastDay = this.config.includeSunday ? 7 : 6;
    for (let dayOfWeek = 0; dayOfWeek < lastDay; dayOfWeek++) {
      for (const timeSlot of timeSlots) {
        // HARD CONSTRAINT: Kinder/Jugendliche sind Mo-Fr in der Schule → frühestens 14:00
        // Samstag: keine Einschränkung (kein Schultag)
        if (groupHasMinors && dayOfWeek < 5 && timeSlot.start < '14:00') continue;
        // HARD CONSTRAINT: und am Abend eine Obergrenze — die gab es bisher nicht.
        // Solange nur Mitglieder mit Präferenzen geplant wurden, fiel das nicht
        // auf; sobald alle vorgesehenen Mitglieder eingeplant werden, weicht der
        // Algorithmus auf 20–22 Uhr aus und hätte dort auch Kinder einsortiert.
        if (groupHasMinors && timeSlot.end > MINOR_LATEST_END) continue;

        // HARD CONSTRAINT: Check member availability via pre-computed cache
        // (Sprint 4 P0 #1: O(1) lookup instead of Array.some() per member)
        const availableMembers = members.filter((m) =>
          this.isMemberSlotAvailable(m.id, dayOfWeek, timeSlot)
        );

        if (availableMembers.length < Math.max(1, this.config.groupMinSize)) continue;

        // Sprint 4 refactor: pre-compute the Set of member skill levels once per
        // (day, timeSlot) iteration. The previous code rebuilt the Set inside the
        // trainer loop, so it ran O(trainers) times per slot — a measurable
        // allocation overhead. Levels don't change per trainer, so the Set is
        // stable across the trainer loop.
        const memberLevels = new Set(availableMembers.map((m) => m.promotedLevel || m.skillLevel));

        // HARD CONSTRAINT: Find available trainer
        let bestTrainer: TrainerWithDetails | null = null;
        let bestTrainerScore = -Infinity;

        for (const trainer of trainers) {
          // Check availability via pre-computed cache (Sprint 4 P0 #1)
          if (!this.isTrainerSlotAvailable(trainer.id, dayOfWeek, timeSlot)) continue;

          // Check max sessions
          const currentSessions = trainerSessionCount.get(trainer.id) || 0;
          if (currentSessions >= trainer.maxSessionsPerWeek) continue;

          // Stundenbudget gegen die TATSÄCHLICHE Slot-Länge prüfen. Vorher stand
          // hier `config.slotDurationMinutes`, obwohl Team-/Leistungsgruppen mit
          // 120-Minuten-Slots hereinkommen — Doppelstunden zählten als eine Stunde
          // und Trainer wurden über ihr Wochenlimit hinaus verplant.
          const slotHours = (hhmmToMinutes(timeSlot.end) - hhmmToMinutes(timeSlot.start)) / 60;
          // ponytail: bereits verplante Sessions werden mit der Länge DIESES Slots
          // bewertet, weil die Engine pro Trainer nur Sessions zählt, keine Stunden.
          // Überschätzt die Last bei gemischten Längen — echte Stundenbuchführung
          // erst, wenn ein Verein das wirklich braucht.
          const hoursAssigned = currentSessions * slotHours;
          const maxHours = trainer.maxHoursPerWeek * (trainer.utilizationPct / 100);
          if (hoursAssigned + slotHours > maxHours) continue;

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
          for (const level of memberLevels) {
            if (trainer.specialties.some((s) => specialtyMatchesLevel(s, level))) score += 20;
          }
          score += (trainer.maxSessionsPerWeek - currentSessions) * 5; // prefer less busy
          score += trainer.canTeachGroups.length > 0 ? 10 : 0;
          // Opt #3: age-group alignment — kids need youth specialists, adults avoid them
          const groupHasMinors = members.some((m) => m.isMinor);
          const trainerDoesYouth = trainer.specialties.some((s) => isYouthSpecialty(s));
          if (groupHasMinors && trainerDoesYouth) score += 25;
          if (groupHasMinors && !trainerDoesYouth) score -= 20;
          if (!groupHasMinors && trainerDoesYouth) score -= 10;
          // Q2-Audit (Punkt 11): Einzeltraining — Trainer mit passender Spezialisierung
          // bevorzugen, wenn diese Session nur ein Mitglied hat (Solo-Slice).
          if (
            members.length === 1 &&
            trainer.specialties.some((s) => s.toLowerCase().includes('einzeltraining'))
          ) {
            score += 15;
          }

          if (score > bestTrainerScore) {
            bestTrainerScore = score;
            bestTrainer = trainer;
          }
        }

        if (!bestTrainer) continue;

        // HARD CONSTRAINT: Find available court
        // Bugfix (Q2-Audit): preferredCourtIds (Trainer + Mitglieder) wurden aus der DB
        // geladen aber nie ausgewertet — der erste freie Platz gewann immer. Jetzt werden
        // alle freien Plätze bewertet und der am besten zur Präferenz passende gewählt.
        const courtKey = `${dayOfWeek}_${timeSlot.start}`;
        let selectedCourt: CourtInfo | null = null;
        let bestCourtScore = -Infinity;

        for (const court of courts) {
          const usage = courtTimeSlotUsage.get(court.id) || new Set();
          if (usage.has(courtKey)) continue;
          // Check existing assignments for this court
          const isTaken = existingAssignments.some(
            (a) =>
              a.courtId === court.id &&
              a.dayOfWeek === dayOfWeek &&
              this.timeSlotsOverlap(a.startTime, a.endTime, timeSlot.start, timeSlot.end)
          );
          if (isTaken) continue;

          let courtScore = 0;
          if (bestTrainer.preferredCourtIds.includes(court.id)) courtScore += 5;
          courtScore += members.filter((m) => m.preferredCourtIds.includes(court.id)).length * 2;
          if (courtScore > bestCourtScore) {
            bestCourtScore = courtScore;
            selectedCourt = court;
          }
        }

        // HARD CONSTRAINT: freier Platz — analog zum Trainer oben.
        // Ohne Platz war der Slot bisher trotzdem wählbar ("Court is optional").
        // Bei einem Verein mit nur einer Halle (TC Rheinland, Winter: ein
        // Indoor-Platz für acht Gruppen) gewann deshalb regelmäßig ein bereits
        // belegter Slot, und der Eintrag entstand mit court_id = NULL. Der
        // Publish legt daraus Sessions ohne Platz an, für die keine Buchung
        // entsteht — die Abrechnung stellt die Teilnehmer trotzdem in Rechnung.
        // Ein Verein ganz ohne konfigurierte Plätze plant weiter platzlos; ist
        // aber ein Platz vorhanden und in diesem Slot alles belegt, ist der Slot
        // unbrauchbar und der Algorithmus weicht auf eine freie Zeit aus.
        if (courts.length > 0 && !selectedCourt) continue;

        // Check slot failure rate (soft constraint by default, hard-constraint
        // when `treatHighFailureAsHard` is true — see Optimization #5).
        const slotKey = `${dayOfWeek}_${timeSlot.start}`;
        const failureRate = slotFailureRates[slotKey] || null;
        const failureWarning =
          failureRate !== null && failureRate >= this.config.slotFailureThreshold / 100;

        // Hard constraint: skip slots with unacceptable failure rate if the flag is on.
        if (
          failureWarning &&
          this.config.avoidHighFailureSlots &&
          this.config.treatHighFailureAsHard
        ) {
          continue;
        }

        let score = 0;
        score += availableMembers.length * 10; // prefer fuller groups
        score -= failureWarning && this.config.avoidHighFailureSlots ? 50 : 0;
        // Fix 6: Erwachsene → Abendslots 18–22 Uhr bevorzugen (Berufstätige)
        //         Kinder/Jugend → Nachmittag 14–17 Uhr bevorzugen
        if (!groupHasMinors && dayOfWeek < 6) {
          if (timeSlot.start >= '18:00') score += 12; // Abend-Bonus Berufstätige
          if (timeSlot.start < '14:00') score -= 8; // Vormittag für Erwachsene unattraktiv
        }
        if (groupHasMinors && dayOfWeek < 5) {
          // Nachmittag 14-17 bevorzugen (nach Schule, vor Abendessen)
          if (timeSlot.start >= '14:00' && timeSlot.start < '17:00') score += 10;
        }
        // Opt #2: wish-partner bonus — more wish-pairs fulfillable in this slot = better
        const wishPairsInSlot = members.reduce((sum, m) => {
          const partnerHere = m.wishPartnerIds.filter((wpid) =>
            availableMembers.some((am) => am.id === wpid)
          ).length;
          return sum + partnerHere;
        }, 0);
        score += wishPairsInSlot * 8;
        // Opt #4: experience-based intra-level cohesion — penalise high spread within level
        const expValues = availableMembers.map((m) => m.experienceMonths);
        if (expValues.length > 1) {
          const expSpread = Math.max(...expValues) - Math.min(...expValues);
          score -= Math.floor(expSpread / 6); // -1 per 6 months spread
        }
        // Opt #5: unavailable_dates penalty — members with many absences on this day cost group stability
        const avgAbsences =
          availableMembers.reduce(
            (sum, m) =>
              sum +
              ((m as typeof m & { _unavailByDow?: Record<number, number> })._unavailByDow?.[
                dayOfWeek
              ] ?? 0),
            0
          ) / Math.max(availableMembers.length, 1);
        score -= Math.floor(avgAbsences * 3);

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

  // ═══ Sprint 4 P0 #1: Slot-Lookup-Cache ═══════════════════════════════
  /**
   * Pre-compute (member, day, timeSlot) → boolean and (trainer, day, timeSlot) → boolean
   * availability maps. findBestTimeSlot uses these instead of running
   * `member.availability[day].some(slot => slot.start <= t.start && slot.end >= t.end)`
   * on every iteration, which is the hottest path in the engine
   * (2000m run: 32ms before, ~18ms after expected per SCALING_ANALYSIS.md).
   *
   * Cache key format: `${kind}|${id}|${dayOfWeek}_${slotStart}`
   *   - kind = 'm' (member) or 't' (trainer)
   *   - id = member/trainer UUID
   *   - dayOfWeek = 0..6
   *   - slotStart = \"08:00\", \"09:30\" etc.
   *
   * The cache is invalidated on the next call to buildSlotAvailabilityCaches.
   */
  private buildSlotAvailabilityCaches(
    members: (MemberWithDetails & { _unassignedReason?: string })[],
    trainers: TrainerWithDetails[],
    timeSlots: Array<{ start: string; end: string }>
  ): void {
    this._memberSlotAvail = new Map();
    this._trainerSlotAvail = new Map();
    // Stash the input lists so the slot-check helpers can fall back to a
    // direct Array.some() when the cache is null (unit-test / direct call path).
    this._cachedMembersForSlotCheck = members;
    this._cachedTrainersForSlotCheck = trainers;

    const DAY_NAMES_LOCAL = DAY_NAMES;

    for (let day = 0; day < 7; day++) {
      const dayName = DAY_NAMES_LOCAL[day];
      for (const slot of timeSlots) {
        for (const m of members) {
          const daySlots = m.availability[dayName] || [];
          const ok = daySlots.some((s) => s.start <= slot.start && s.end >= slot.end);
          this._memberSlotAvail.set(`m|${m.id}|${day}_${slot.start}`, ok);
        }
        for (const t of trainers) {
          const daySlots = t.availability[dayName] || [];
          const ok = daySlots.some((s) => s.start <= slot.start && s.end >= slot.end);
          this._trainerSlotAvail.set(`t|${t.id}|${day}_${slot.start}`, ok);
        }
      }
    }
  }

  /**
   * Fast member-availability lookup: O(1) Map.get() instead of Array.some().
   * Returns true iff the member has at least one availability window that fully
   * covers the given (day, timeSlot).
   *
   * Sprint 4 follow-up: when the pre-computed cache is null (direct callers
   * like unit tests that call `findBestTimeSlot` without going through
   * `runClustering`), falls back to a linear search over the last-known
   * member list. Preserves the original semantics for production callers
   * (where the cache is always populated) while letting tests use the same
   * entry point.
   */
  private isMemberSlotAvailable(
    memberId: string,
    dayOfWeek: number,
    timeSlot: { start: string; end: string }
  ): boolean {
    if (this._memberSlotAvail) {
      return this._memberSlotAvail.get(`m|${memberId}|${dayOfWeek}_${timeSlot.start}`) ?? false;
    }
    const member = this._cachedMembersForSlotCheck?.find((m) => m.id === memberId);
    if (!member) return false;
    const dayName = DAY_NAMES[dayOfWeek];
    const daySlots = member.availability[dayName] || [];
    return daySlots.some((s) => s.start <= timeSlot.start && s.end >= timeSlot.end);
  }

  /**
   * Fast trainer-availability lookup: O(1) Map.get() instead of Array.some().
   * Note: this checks *availability only* — max-sessions and hours-limit checks
   * remain in findBestTimeSlot (those depend on per-run state).
   *
   * Sprint 4 follow-up: same null-cache fallback as `isMemberSlotAvailable`.
   */
  private isTrainerSlotAvailable(
    trainerId: string,
    dayOfWeek: number,
    timeSlot: { start: string; end: string }
  ): boolean {
    if (this._trainerSlotAvail) {
      return this._trainerSlotAvail.get(`t|${trainerId}|${dayOfWeek}_${timeSlot.start}`) ?? false;
    }
    const trainer = this._cachedTrainersForSlotCheck?.find((t) => t.id === trainerId);
    if (!trainer) return false;
    const dayName = DAY_NAMES[dayOfWeek];
    const daySlots = trainer.availability[dayName] || [];
    return daySlots.some((s) => s.start <= timeSlot.start && s.end >= timeSlot.end);
  }

  /**
   * Build default weekday availability (Mon-Fri 08:00-22:00) for trainers
   * who haven't submitted explicit preferences. This ensures they can still
   * be assigned to time slots by the clustering algorithm.
   */
  private buildDefaultAvailability(): WeeklyAvailability {
    const defaultSlot = { start: '08:00', end: '22:00' };
    const satSlot = { start: '08:00', end: '18:00' };
    return {
      monday: [defaultSlot],
      tuesday: [defaultSlot],
      wednesday: [defaultSlot],
      thursday: [defaultSlot],
      friday: [defaultSlot],
      saturday: [satSlot],
      sunday: [],
    };
  }

  private timeSlotsOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
    return timeSlotsOverlap(start1, end1, start2, end2);
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
    // If a member wanted to be in a specific group but it's full, put them on waitlist.
    // Performance fix: build member + group-member indices once (O(n + g·m)) instead of
    // the previous O(n · g · m) pattern with repeated `members.find` and `assignments.find`.
    const memberById = new Map<string, (typeof members)[number]>();
    for (const m of members) memberById.set(m.id, m);

    const groupMemberIndex = new Map<string, GroupAssignment>();
    for (const a of assignments) {
      for (const mid of a.memberIds) groupMemberIndex.set(mid, a);
    }

    for (const assignment of assignments) {
      const groupMembers = new Set(assignment.memberIds);

      for (const detail of assignment.memberDetails) {
        const member = memberById.get(detail.memberId);
        if (!member || member.wishPartnerIds.length === 0) continue;

        for (const wpid of member.wishPartnerIds) {
          if (groupMembers.has(wpid)) continue; // already together

          // O(1) lookup instead of assignments.find (was O(g))
          const partnerAssignment = groupMemberIndex.get(wpid);
          if (!partnerAssignment) continue;

          // Check if there's space in partner's group — Q2-Audit (Punkt 11):
          // partnerAssignment.maxSize ist die tatsächliche Kapazität dieser Zuweisung
          // (Gruppen-Override falls gesetzt), nicht immer der globale Default.
          if (
            partnerAssignment.memberIds.length + partnerAssignment.waitlistIds.length >=
            partnerAssignment.maxSize
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

    // Wer nach allen Runden in keiner Gruppe gelandet ist, fiel bisher lautlos aus
    // der Planung — die Warteliste kannte ausschließlich den Wunschpartner-Fall.
    // Für den Verein ist genau das der wichtigere Fall: Diese Mitglieder wollen
    // Training, haben aber keinen Platz bekommen, und jemand muss darüber
    // entscheiden. Sie kommen auf die Warteliste der fachlich am besten passenden
    // Gruppe. Nachgerückt wird bewusst nicht automatisch.
    const groupInfoById = new Map(_groups.map((g) => [g.id, g]));
    const alreadyWaitlisted = new Set(waitlisted.map((w) => w.memberId));

    for (const member of members) {
      if (assignments.length === 0) break;
      if (groupMemberIndex.has(member.id) || alreadyWaitlisted.has(member.id)) continue;

      const level = member.promotedLevel || member.skillLevel;
      const ageGroup = member.isMinor ? 'kids' : 'adult';
      const best =
        assignments.find((a) => {
          const info = groupInfoById.get(a.groupId);
          return info?.level === level && info?.ageGroup === ageGroup;
        }) ??
        assignments.find((a) => groupInfoById.get(a.groupId)?.ageGroup === ageGroup) ??
        assignments[0];

      const position = best.waitlistIds.length + 1;
      best.waitlistIds.push(member.id);
      best.waitlistDetails.push({ memberId: member.id, memberName: member.name, position });
      waitlisted.push({ memberId: member.id, groupId: best.groupId, position });
      summary.push({
        memberId: member.id,
        memberName: member.name,
        groupName: best.groupName,
        position,
        // Es gibt keine Ausweichgruppe — das Mitglied ist in gar keiner.
        alternativeGroupName: null,
      });
      alreadyWaitlisted.add(member.id);
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
    // Sprint 4 refactor: build a trainer id -> trainer map once so the per-trainer
    // `trainers.find(t => t.id === tid)` scan (O(trainers) per assignment) becomes
    // an O(1) Map.get(). Combined with the same change in generateExplanations,
    // this saves a small but measurable amount of time in the metrics phase.
    const trainerByIdForMetrics = new Map<string, TrainerWithDetails>();
    for (const t of trainers) trainerByIdForMetrics.set(t.id, t);

    const trainerUtils = Object.entries(trainerLoads).map(([tid, sessions]) => {
      const trainer = trainerByIdForMetrics.get(tid);
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

  /**
   * Bugfix (Q2-Audit / structural): bitmask of which weekdays a member has ANY
   * availability window on. Used as a secondary sort key so `assignMembersToGroups`'
   * sort-and-slice naturally clusters members with overlapping schedules adjacent to
   * each other, instead of slicing purely by niveau+experience and hoping a common
   * time slot exists afterwards (previously: whole slices failed outright — "Kein
   * verfügbarer Zeitslot" — when a level-sorted slice happened to mix incompatible
   * schedules).
   */
  private availabilityBitmask(member: MemberWithDetails): number {
    let mask = 0;
    for (let i = 0; i < DAY_NAMES.length; i++) {
      if ((member.availability[DAY_NAMES[i]] || []).length > 0) mask |= 1 << i;
    }
    return mask;
  }

  /**
   * Bugfix (Q2-Audit / structural): wish partners (mutual "will mit X trainieren")
   * and previous-season group-mates previously only influenced slot SCORING after
   * group composition was already fixed — a bonus for slot timing, never a reason
   * to actually place two people in the same slice. This union-find groups members
   * who should end up adjacent in the sort order (and therefore, via sort-and-slice,
   * in the same group) by wish-partner links and — if `preferHistoricGroups` is on —
   * shared previous-season group membership. Returns memberId -> small sequential
   * component index (lower = earlier in sort order; the exact number is arbitrary,
   * only equality/ordering matters).
   */
  private computeAffinityGroups(
    cohort: (MemberWithDetails & { _unassignedReason?: string })[]
  ): Map<string, number> {
    const parent = new Map<string, string>();
    const find = (id: string): string => {
      let root = id;
      while (parent.get(root) && parent.get(root) !== root) root = parent.get(root)!;
      parent.set(id, root);
      return root;
    };
    const union = (a: string, b: string) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };

    for (const m of cohort) parent.set(m.id, m.id);
    const cohortIds = new Set(cohort.map((m) => m.id));

    for (const m of cohort) {
      for (const wpid of m.wishPartnerIds) {
        if (cohortIds.has(wpid)) union(m.id, wpid);
      }
      if (this.config.preferHistoricGroups && m.previousGroupId) {
        const anchorKey = `__prevgroup__${m.previousGroupId}`;
        if (!parent.has(anchorKey)) parent.set(anchorKey, anchorKey);
        union(m.id, anchorKey);
      }
    }

    // Mitglieder ohne Wunschpartner und ohne Vorsaison-Gruppe bilden je eine
    // eigene Komponente. Bekämen sie eine eigene Nummer, wäre der Affinitäts-
    // Vergleich in `assignMembersToGroups` für sie IMMER ungleich — die
    // nachgelagerten Sortierschlüssel (Verfügbarkeit, Priorität, Erfahrung)
    // würden nie erreicht. Sie teilen sich deshalb einen neutralen Wert, der
    // hinter allen echten Clustern einsortiert.
    const componentSize = new Map<string, number>();
    for (const m of cohort) {
      const root = find(m.id);
      componentSize.set(root, (componentSize.get(root) ?? 0) + 1);
    }
    const SINGLETON = Number.MAX_SAFE_INTEGER;
    const rootToIndex = new Map<string, number>();
    const result = new Map<string, number>();
    for (const m of cohort) {
      const root = find(m.id);
      if ((componentSize.get(root) ?? 0) < 2) {
        result.set(m.id, SINGLETON);
        continue;
      }
      if (!rootToIndex.has(root)) rootToIndex.set(root, rootToIndex.size);
      result.set(m.id, rootToIndex.get(root)!);
    }
    return result;
  }

  private computeNiveauMatch(
    member: MemberWithDetails & { _unassignedReason?: string },
    group: (MemberWithDetails & { _unassignedReason?: string })[]
  ): number {
    return computeNiveauMatchScore(
      member.experienceMonths,
      group.map((m) => m.experienceMonths)
    );
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
    // Sprint 4 refactor: O(1) trainer lookup (was O(trainers) per assignment via Array.find).
    const trainerByIdForExplanations = new Map<string, TrainerWithDetails>();
    for (const t of trainers) trainerByIdForExplanations.set(t.id, t);

    for (const [tid, count] of Object.entries(trainerCounts)) {
      const trainer = trainerByIdForExplanations.get(tid);
      if (trainer) {
        // Slot-Dauer kommt aus der DB-Config (default 60min im Engine-Default,
        // 90min in der DB-Migration). Wir rechnen mit der effektiven Dauer
        // statt einer hartcodierten 1,5h, sodass 60-Minuten-Konfigurationen
        // korrekt dargestellt werden. Team-/Doppelstunden sind im Engine-
        // Engine separat gehandhabt (groupTimeSlots mit teamSlotMinutes).
        const hoursPerSession = this.config.slotDurationMinutes / 60;
        const hours = count * hoursPerSession;
        const max = trainer.maxHoursPerWeek * (trainer.utilizationPct / 100);
        explanations.push(
          `Trainer ${trainer.name}: ${count} Sessions (${hours.toFixed(2)}h à ${this.config.slotDurationMinutes}min von max ${max.toFixed(2)}h)`
        );
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
    // Eine Neuplanung löscht die Planeinträge. Bereits veröffentlichte Einheiten
    // hängen per FK daran — aber mit ON DELETE SET NULL: sie verlieren nur ihren
    // Verweis und bleiben samt Buchungen im Kalender stehen. Beim nächsten
    // Veröffentlichen kollidieren sie dann mit den neuen Terminen auf demselben
    // Platz, und der Vorgang scheitert mit einem rohen SQL-Fehler. Künftige
    // Termine werden deshalb hier mit verworfen; stattgefundene bleiben Historie.
    const existingEntries = await db
      .select({ id: seasonPlanEntries.id })
      .from(seasonPlanEntries)
      .where(eq(seasonPlanEntries.season_id, this.seasonId));

    if (existingEntries.length > 0) {
      const staleSessions = await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(
          and(
            inArray(
              sessions.plan_entry_id,
              existingEntries.map((e) => e.id)
            ),
            gte(sessions.timeslot_start, new Date())
          )
        );
      const staleIds = staleSessions.map((s) => s.id);
      // ponytail: 500er-Blöcke wegen des Postgres-Parameterlimits, wie im
      // Veröffentlichen-Pfad.
      for (let i = 0; i < staleIds.length; i += 500) {
        const chunk = staleIds.slice(i, i + 500);
        await db.delete(bookings).where(inArray(bookings.session_id, chunk));
        await db.delete(sessions).where(inArray(sessions.id, chunk));
      }
      if (staleIds.length > 0) {
        log.info('Neuplanung: künftige veröffentlichte Einheiten verworfen', {
          seasonId: this.seasonId,
          sessions: staleIds.length,
        });
      }
    }

    // Delete existing plan entries for this season (re-planning)
    await db.delete(seasonPlanEntries).where(eq(seasonPlanEntries.season_id, this.seasonId));

    // Delete existing waitlists
    await db.delete(seasonWaitlists).where(eq(seasonWaitlists.season_id, this.seasonId));

    // Der "Einzeltraining …"-Name entsteht im Moment der Gruppenanlage, als die
    // Gruppe noch aus einer Person bestand. Kommen später Teilnehmer dazu (zweite
    // Runde, Backtracking), stand bisher der Name eines einzelnen Mitglieds über
    // einer Vierergruppe — sichtbar für Trainer und alle Teilnehmer. Hier steht die
    // endgültige Belegung fest, also wird der Name hier geradegezogen.
    for (const [idx, g] of result.groups.entries()) {
      const isPlaceholder = g.groupId.startsWith(PLACEHOLDER_GROUP_PREFIX);
      let renamed: string | null = null;
      if (g.memberIds.length > 1 && g.groupName.startsWith('Einzeltraining ')) {
        const prefix = g.groupName.replace(/^Einzeltraining /, '').split(' — ')[0];
        renamed = `${prefix} Gruppe ${idx + 1}`;
        // Die Warteliste referenziert Gruppen unten über den NAMEN. Ohne diesen
        // Abgleich zeigte ein umbenannter Eintrag ins Leere und wurde mit
        // group_id = '' geschrieben.
        const oldName = g.groupName;
        for (const w of result.waitlistSummary) {
          if (w.groupName === oldName) w.groupName = renamed;
          if (w.alternativeGroupName === oldName) w.alternativeGroupName = renamed;
        }
        g.groupName = renamed;
      }

      if (!isPlaceholder) {
        if (renamed) await db.update(groups).set({ name: renamed }).where(eq(groups.id, g.groupId));
        continue;
      }

      // Erst hier entsteht die Gruppe wirklich — der Rechenlauf hat nur einen
      // Platzhalter erzeugt (siehe `pendingGroups`). Damit legen Dry Runs und
      // verworfene Multi-Start-Varianten keine verwaisten Zeilen mehr an.
      const pending = this.pendingGroups.get(g.groupId);
      const [newGroup] = await db
        .insert(groups)
        .values({
          club_id: this.clubId,
          name: g.groupName,
          level: pending?.level ?? 'beginner',
          age_group: pending?.ageGroup ?? 'adult',
          is_active: true,
          member_ids: [],
        })
        .returning({ id: groups.id });

      // Planeinträge und Warteliste unten lesen `g.groupId` bzw. den Namen —
      // beides zeigt ab hier auf die echte Zeile.
      g.groupId = newGroup.id;
    }

    // Insert new plan entries
    const entriesToInsert = result.groups.map((g) => ({
      season_id: this.seasonId,
      club_id: this.clubId,
      trainer_id: g.trainerId,
      court_id: g.courtId,
      group_id: realGroupId(g.groupId),
      day_of_week: g.dayOfWeek,
      start_time: `${g.startTime}:00`,
      end_time: `${g.endTime}:00`,
      // Use configured slot duration instead of recomputing from HH:MM diff
      // (more robust against malformed times, single source of truth)
      duration_minutes: this.config.slotDurationMinutes,
      starts_from_week: 1,
      ends_at_week: null,
      // Q2-Audit (Punkt 11): eine Session mit genau 1 Teilnehmer ist ein Einzeltraining
      // ('private_lesson' ist ein bereits vorhandener, DB-seitig erlaubter Wert — siehe
      // CHECK-Constraint in season_planning_groups-Migration), kein "Gruppentraining
      // mit 1 Person". Deckt Haupt-Pass, Second-Pass-Reste und Backtracking-Solo-
      // Zuweisungen gleichermaßen ab, ohne dass jede Entstehungsstelle das explizit
      // markieren muss.
      entry_type: g.memberIds.length === 1 ? 'private_lesson' : 'training',
      planning_source: 'auto',
      // Q2-Audit (Punkt 11): individuelle Gruppenkapazität statt immer dem globalen
      // Default — war zuvor blind this.config.groupMaxSize für ALLE Einträge.
      max_participants: g.maxSize,
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
      // Typed via Drizzle's $inferInsert — documents the intended payload shape
      // (one object per row) instead of `as never`. The `unknown` bridge is needed
      // because the in-memory mapper may set fields to `undefined` or omit them,
      // which Drizzle's strict `.values()` overloads reject when handed Partial<T>.
      const typedPlanEntries =
        entriesToInsert as unknown as (typeof seasonPlanEntries.$inferInsert)[];
      await db.insert(seasonPlanEntries).values(typedPlanEntries);
    }

    // Insert waitlist entries.
    //
    // `season_waitlists.group_id` ist NOT NULL — ein Wartender wartet immer auf
    // eine bestimmte Gruppe. Findet sich dazu keine echte Gruppe (etwa weil das
    // Backtracking eine Ersatzgruppe ohne DB-Entsprechung erzeugt hat), lässt
    // sich der Eintrag nicht speichern. Bis zum 16.08.2026 wurde in dem Fall ein
    // leerer String eingesetzt, was den gesamten Speichervorgang abbrechen liess
    // — mitsamt der bereits berechneten Planung. Solche Einträge werden jetzt
    // übersprungen und gezählt, statt alles scheitern zu lassen.
    const waitlistCandidates = result.waitlistSummary.map((w) => ({
      season_id: this.seasonId,
      club_id: this.clubId,
      group_id: realGroupId(result.groups.find((g) => g.groupName === w.groupName)?.groupId),
      member_id: w.memberId,
      position: w.position,
      priority: 5,
      priority_reason: this.config.waitlistPriorityRule,
      status: 'waiting' as const,
      alternative_group_id: w.alternativeGroupName
        ? realGroupId(result.groups.find((g) => g.groupName === w.alternativeGroupName)?.groupId)
        : null,
    }));

    const waitlistToInsert = waitlistCandidates.filter(
      (w): w is typeof w & { group_id: string } => w.group_id !== null
    );

    const uebersprungen = waitlistCandidates.length - waitlistToInsert.length;
    if (uebersprungen > 0) {
      log.warn('Wartelisteneinträge ohne echte Gruppe übersprungen', {
        seasonId: this.seasonId,
        uebersprungen,
        gesamt: waitlistCandidates.length,
      });
    }

    if (waitlistToInsert.length > 0) {
      // Typed via Drizzle's $inferInsert — see comment above on the plan-entries cast.
      const typedWaitlist = waitlistToInsert as unknown as (typeof seasonWaitlists.$inferInsert)[];
      await db.insert(seasonWaitlists).values(typedWaitlist);
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

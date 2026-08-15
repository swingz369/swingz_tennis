/**
 * Season Planning Analytics — ROI-stats aggregation (Q1 Epic 1.2 — KI-Premium-Sichtbarkeit)
 *
 * Pure functions over {@link DryRunReport} from `dry-run.service.ts`.
 * Used by:
 *   - The planning page (read-only "Dein Plan in Zahlen" block; W2-build)
 *   - {@link PremiumUpsell} modal (1.2.2) — the Starter→Pro upgrade nudge
 *
 * Pure on purpose:
 *   - Unit-testable in isolation (no DB / network).
 *   - Same input → same output → deterministic UI.
 *   - Cheap to call repeatedly: no allocations beyond head/tail arrays.
 */

import type { DryRunReport } from '@/lib/season-planning/dry-run.service';

/**
 * Minimum shape that `computeRoiStats` needs. Declared structurally so
 * unit-tests can supply a minimal stub without faking the entire report.
 * The full {@link DryRunReport} from the dry-run API satisfies this fully.
 */
export interface RoiInput {
  summary: DryRunReport['summary'];
  billing: DryRunReport['billing'];
}

/**
 * Friendly, marketing-ready ROI numbers derived from a dry-run.
 * All numbers are display-ready (rounded). German copy lives in the UI, not the type.
 */
export interface RoiStats {
  /** Conflicts the AI surfaced before publish — i.e. avoided "publish → regret". */
  conflictsResolved: number;
  /** Trainer hours the plan optimises across the season. Rounded to 0.1h. */
  trainerHoursOptimized: number;
  /** Distinct members that the plan would invoice. */
  membersServed: number;
  /** Expected RSVP acceptance (0..1) projected from past season. */
  expectedAcceptanceRate: number;
  /** Heuristic: admin time a human would have spent on the same plan. Clamped ≥ 1. */
  adminHoursSaved: number;
  /** Heuristic EUR value of those admin hours (assumes 35 €/h conservative rate). */
  estimatedSavingsEur: number;
  /** Composed string for the modal headline: "X Konflikte vermieden · Y Trainer-Stunden geplant · Z Mitglieder im Blick". */
  headline: string;
  /** Bullet-list snippets (≤ 3) the upsell modal can cycle through. Always ≥ 1. */
  bullets: string[];
}

const ADMIN_HOURLY_RATE_EUR = 35;
/**
 * Average minutes a human spends per generated session when planning by hand.
 * Rough heuristic derived from club-convention talks (~12 min/session for
 * correspondence, court booking, group balancing, RSVP setup).
 */
const MANUAL_MIN_PER_SESSION = 12;
/** Base overhead for any new season (data sanity checks, communication blasts, etc.). */
const MANUAL_OVERHEAD_MIN = 90;

/**
 * Pure: derive {@link RoiStats} from a {@link DryRunReport}-shaped input.
 * Exhaustive: every output field is fully determined by the input — no clock,
 * no randomness, no DB lookup. Safe for React render and SSR.
 */
export function computeRoiStats(input: RoiInput): RoiStats {
  const s = input.summary;

  const conflictsResolved = s.criticalConflictCount + s.warningConflictCount + s.infoConflictCount;
  const trainerHoursOptimized = Math.round(s.totalTrainerHours * 10) / 10;
  const membersServed = s.invoicedMemberCount;

  // Admin hours saved: combined heuristic from sessions + overhead. Clamp to ≥ 1
  // so the message is never "0 Std gespart", which feels like a marketing failure.
  // Sessions × 12 min is the manual-equivalent cost; trainer-hours × 4 reflects
  // the 4× leverage typical of algorithmic balancing vs manual hand-tuning.
  const manualMinutes = MANUAL_OVERHEAD_MIN + s.wouldCreateSessions * MANUAL_MIN_PER_SESSION;
  const adminMinutesFromTrainers = s.totalTrainerHours * 4;
  const adminHoursSavedRaw = (manualMinutes + adminMinutesFromTrainers) / 60;
  const adminHoursSaved = Math.max(1, Math.round(adminHoursSavedRaw));

  const estimatedSavingsEur = Math.round(adminHoursSaved * ADMIN_HOURLY_RATE_EUR);

  // Round acceptance rate to 1 decimal place to match "66 %" / "66.7 %" copy rules
  const expectedAcceptanceRate = Math.round(s.expectedAcceptanceRate * 100) / 100;

  // Plural nouns (German convention: 0 + ≥2 plural, 1 singular).
  const conflictNoun = conflictsResolved === 1 ? 'Konflikt vermieden' : 'Konflikte vermieden';
  const memberNoun = membersServed === 1 ? 'Mitglied' : 'Mitglieder';
  const headline =
    `${conflictsResolved} ${conflictNoun} · ` +
    `${trainerHoursOptimized} Trainer-Stunden geplant · ` +
    `${membersServed} ${memberNoun} im Blick`;

  // Pre-built bullet lines for the modal. The modal renders them verbatim;
  // wording stays neutral (no "Starter ist schlecht" tone — we frame it as
  // "mehr Mehrwert durch KI", never as "du fehlst etwas").
  const bullets: string[] = [];
  if (conflictsResolved > 0) {
    bullets.push(
      `${conflictsResolved} Konflikt${conflictsResolved !== 1 ? 'e' : ''} vor der Veröffentlichung erkannt — sonst wären Doppelbuchungen und Engpässe Realität geworden.`
    );
  }
  if (trainerHoursOptimized > 0) {
    bullets.push(
      `Trainer-Auslastung automatisch verteilt: ${trainerHoursOptimized} Stunden über alle ${s.activeTrainerCount} Trainer-Slots ausbalanciert.`
    );
  }
  if (membersServed > 0) {
    bullets.push(
      `${membersServed} ${membersServed === 1 ? 'Mitglieds-' : 'Mitglieder-'}Beiträge sauber kalkuliert — Rechnungen und E-Mails gehen in einem Rutsch raus.`
    );
  }
  if (bullets.length === 0) {
    bullets.push(
      'Plan steht — du kannst jederzeit veröffentlichen. Die KI steht für den nächsten Saison-Lauf bereit.'
    );
  }

  return {
    conflictsResolved,
    trainerHoursOptimized,
    membersServed,
    expectedAcceptanceRate,
    adminHoursSaved,
    estimatedSavingsEur,
    headline,
    bullets,
  };
}

/**
 * Cheap `isStarterTier` predicate.
 *
 * The club's feature flags expose `partner_finder` (defined in {@link CLUB_FEATURES});
 * if it is *off*, the club is on the Starter tier (Pro includes the AI features).
 * Accepts the raw DB row OR a `Record<string, boolean>` shape — both are tolerated.
 *
 * Use this from the upsell modal orchestration to decide whether to render
 * (1.2.2 ticket requirement: "Modal sichtbar für Starter-Tier-Nutzer").
 *
 * Conservative default: when features are absent, treat as Starter (safer to
 * over-nudge than to miss a paying-prospect with a free kicker).
 */
export function isStarterTier(features: Record<string, boolean> | null | undefined): boolean {
  if (!features) return true;
  // Pro tier implies the AI matchmaking feature is enabled. Off → Starter.
  return features.partner_finder !== true;
}

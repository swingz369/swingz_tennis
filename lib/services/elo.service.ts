/**
 * lib/services/elo.service.ts
 *
 * Sprint 4 Q2 — Ticket 2.2.1 (ELO DB-Trigger)
 *
 * Pure ELO calculation functions. The SQL trigger in
 * `supabase/migrations/20260630_elo_trigger.sql` implements the same formula
 * in PL/pgSQL. The two implementations MUST stay in sync — deviations are
 * caught by ticket 2.2.4 (Backing-Tests gegen SQL-Trigger).
 *
 * ELO-Formel (Standard):
 *   E_A = 1 / (1 + 10^((R_B - R_A) / 400))
 *   R_A' = R_A + ROUND(K * (S_A - E_A))
 *     mit S_A = 1 (Sieg) oder 0 (Niederlage) — kein Unentschieden (Ticket-Spec)
 *   K-Faktor: 32 (Ticket-Spec)
 *
 * Architektur (per Codebase-Convention, vgl. lib/match-completion-push.service.ts):
 *   - Pure functions for testability (expectedScore, averageRating, updateElo,
 *     computeMatchUpdates)
 *   - Service class for stable import path (EloService)
 */

// ─── Constants ────────────────────────────────────────────────────────

/** K-Faktor für alle ELO-Berechnungen (Ticket 2.2.1 Spec). */
export const DEFAULT_K_FACTOR = 32;

/** Startwert für neue Spieler (Standard-ELO). */
export const DEFAULT_RATING = 1200;

// ─── Types ────────────────────────────────────────────────────────────

export interface EloUpdate {
  /** Neues Rating nach dem Match (gerundet auf Integer). */
  newRating: number;
  /** Differenz zum alten Rating (positiv = Gewinn, negativ = Verlust). */
  delta: number;
}

export interface MatchEloDeltas {
  /** Deltas für jeden Spieler des Heim-Teams (gleicher Wert für alle). */
  homeDeltas: number[];
  /** Deltas für jeden Spieler des Gast-Teams. */
  awayDeltas: number[];
}

// ─── Pure helpers (testable without DB) ──────────────────────────────

/** Expected Score für Spieler A gegen Gegner B.
 *  Formel: 1 / (1 + 10^((R_B - R_A) / 400))
 *  Liefert 0.5 bei gleichem Rating, > 0.5 wenn A höher, < 0.5 wenn A niedriger. */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/** Durchschnitts-ELO eines Teams (für Doppel: 2 Spieler).
 *  Gibt DEFAULT_RATING zurück für leeres Array (Fallback). */
export function averageRating(ratings: number[]): number {
  if (ratings.length === 0) return DEFAULT_RATING;
  return ratings.reduce((a, b) => a + b, 0) / ratings.length;
}

/**
 * Berechnet das neue ELO-Rating eines Spielers nach einem Match.
 * Pure function — keine DB, keine Side-Effects.
 *
 * @param currentRating   Aktuelles ELO des Spielers
 * @param opponentRatings ELO(s) der Gegner (1 für Einzel, 2 für Doppel)
 * @param won             true = Sieg, false = Niederlage (kein Unentschieden)
 * @param kFactor         K-Faktor (Default 32, Ticket-Spec)
 * @returns Neues Rating und Delta (beide Integer, ROUND-matching mit SQL)
 */
export function updateElo(
  currentRating: number,
  opponentRatings: number[],
  won: boolean,
  kFactor: number = DEFAULT_K_FACTOR
): EloUpdate {
  if (opponentRatings.length === 0) {
    return { newRating: currentRating, delta: 0 };
  }
  const oppAvg = averageRating(opponentRatings);
  const expected = expectedScore(currentRating, oppAvg);
  const actual = won ? 1 : 0;
  // Match SQL: ROUND(kFactor * (actual - expected))
  const delta = Math.round(kFactor * (actual - expected));
  return { newRating: currentRating + delta, delta };
}

/**
 * Berechnet ELO-Updates für alle Spieler eines Medenspiels.
 * Bequeme Wrapper-Funktion: ruft updateElo-Logik für beide Teams auf.
 * Wichtig: Alle Spieler einer Seite erhalten das GLEICHE Delta (Team-ELO).
 *
 * @param homeRatings  ELO der Heim-Spieler (1 für Einzel, 2 für Doppel)
 * @param awayRatings  ELO der Gast-Spieler
 * @param homeWon      true = Heim gewinnt, false = Gast gewinnt
 * @param kFactor      K-Faktor (Default 32)
 */
export function computeMatchUpdates(
  homeRatings: number[],
  awayRatings: number[],
  homeWon: boolean,
  kFactor: number = DEFAULT_K_FACTOR
): MatchEloDeltas {
  const homeAvg = averageRating(homeRatings);
  const awayAvg = averageRating(awayRatings);
  const homeExpected = expectedScore(homeAvg, awayAvg);
  const awayExpected = 1 - homeExpected;
  const homeActual = homeWon ? 1 : 0;
  const awayActual = homeWon ? 0 : 1;
  const homeDelta = Math.round(kFactor * (homeActual - homeExpected));
  const awayDelta = Math.round(kFactor * (awayActual - awayExpected));
  return {
    homeDeltas: homeRatings.map(() => homeDelta),
    awayDeltas: awayRatings.map(() => awayDelta),
  };
}

// ─── Service class ────────────────────────────────────────────────────

/** Service class für ELO-Operationen. Stellt stable import path bereit
 *  für zukünftige DB-backed Operations (z.B. ELO-Historie, Reset, etc.). */
export class EloService {
  static readonly DEFAULT_K_FACTOR = DEFAULT_K_FACTOR;
  static readonly DEFAULT_RATING = DEFAULT_RATING;
  static expectedScore = expectedScore;
  static averageRating = averageRating;
  static updateElo = updateElo;
  static computeMatchUpdates = computeMatchUpdates;
}

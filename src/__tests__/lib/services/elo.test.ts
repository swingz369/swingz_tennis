/**
 * src/__tests__/lib/services/elo.test.ts
 * (konsolidiert aus tests/unit/lib/services/elo.test.ts)
 *
 * Sprint 4 Q2 — Ticket 2.2.1 (ELO DB-Trigger)
 *
 * Unit tests for the pure ELO functions. The SQL trigger implementation
 * (supabase/migrations/20260630_elo_trigger.sql) is integration-tested via
 * ticket 2.2.4 (Backing-Tests gegen SQL-Trigger).
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_K_FACTOR,
  DEFAULT_RATING,
  expectedScore,
  averageRating,
  updateElo,
  computeMatchUpdates,
  EloService,
} from '@/lib/services/elo.service';

describe('elo.service — constants', () => {
  it('default K-factor is 32 (per ticket spec)', () => {
    expect(DEFAULT_K_FACTOR).toBe(32);
  });

  it('default rating is 1200 (standard ELO starting point)', () => {
    expect(DEFAULT_RATING).toBe(1200);
  });
});

describe('elo.service — expectedScore', () => {
  it('returns 0.5 when both players have equal rating', () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 5);
  });

  it('returns > 0.5 when player A has higher rating (favored)', () => {
    expect(expectedScore(1700, 1500)).toBeGreaterThan(0.5);
  });

  it('returns < 0.5 when player A has lower rating (underdog)', () => {
    expect(expectedScore(1500, 1700)).toBeLessThan(0.5);
  });

  it('returns ~0.76 for 200-point favorite (standard ELO)', () => {
    // 10^((1500-1700)/400) = 10^(-0.5) ≈ 0.316 → 1/(1+0.316) ≈ 0.760
    expect(expectedScore(1700, 1500)).toBeCloseTo(0.76, 3);
  });

  it('returns ~0.24 for 200-point underdog', () => {
    expect(expectedScore(1500, 1700)).toBeCloseTo(0.24, 3);
  });

  it('returns ~0.91 for 400-point favorite', () => {
    expect(expectedScore(1900, 1500)).toBeCloseTo(0.909, 3);
  });

  it('returns ~0.09 for 400-point underdog', () => {
    expect(expectedScore(1500, 1900)).toBeCloseTo(0.091, 3);
  });

  it('is symmetric: expectedScore(A,B) + expectedScore(B,A) = 1', () => {
    const a = 1700;
    const b = 1500;
    expect(expectedScore(a, b) + expectedScore(b, a)).toBeCloseTo(1, 5);
  });
});

describe('elo.service — averageRating', () => {
  it('returns DEFAULT_RATING for empty array', () => {
    expect(averageRating([])).toBe(DEFAULT_RATING);
  });

  it('returns the single rating for a one-element array', () => {
    expect(averageRating([1500])).toBe(1500);
  });

  it('returns the mean for two ratings', () => {
    expect(averageRating([1500, 1700])).toBe(1600);
  });

  it('returns the mean for three ratings', () => {
    expect(averageRating([1200, 1300, 1400])).toBeCloseTo(1300, 5);
  });
});

describe('elo.service — updateElo', () => {
  it('returns delta=0 and unchanged rating for empty opponent list', () => {
    expect(updateElo(1500, [], true)).toEqual({ newRating: 1500, delta: 0 });
  });

  it('gains small points when a higher-rated player wins (expected outcome)', () => {
    // 1700 vs 1500: expected ~0.76, actual 1 → delta = round(32 * 0.24) = 8
    const result = updateElo(1700, [1500], true);
    expect(result.delta).toBe(8);
    expect(result.newRating).toBe(1708);
  });

  it('gains many points when a lower-rated player wins (upset)', () => {
    // 1500 vs 1700: expected ~0.24, actual 1 → delta = round(32 * 0.76) = 24
    const result = updateElo(1500, [1700], true);
    expect(result.delta).toBe(24);
    expect(result.newRating).toBe(1524);
  });

  it('loses many points when a higher-rated player loses (upset)', () => {
    // 1700 vs 1500: expected ~0.76, actual 0 → delta = round(32 * (0 - 0.76)) = -24
    const result = updateElo(1700, [1500], false);
    expect(result.delta).toBe(-24);
    expect(result.newRating).toBe(1676);
  });

  it('loses small points when a lower-rated player loses (expected loss)', () => {
    // 1500 vs 1700: expected ~0.24, actual 0 → delta = round(32 * (0 - 0.24)) = -8
    const result = updateElo(1500, [1700], false);
    expect(result.delta).toBe(-8);
    expect(result.newRating).toBe(1492);
  });

  it('zero-sum for equal ratings: winner gain + loser loss = 0', () => {
    const winner = updateElo(1500, [1500], true);
    const loser = updateElo(1500, [1500], false);
    expect(winner.delta + loser.delta).toBe(0);
  });

  it('handles doubles (2 opponents): averages their ratings', () => {
    // vs [1500, 1700] (avg 1600), win → expected ~0.36, delta = round(32 * 0.64) = 20
    const result = updateElo(1500, [1500, 1700], true);
    expect(result.delta).toBe(20);
  });

  it('respects custom K-factor', () => {
    // K=16 (half), 1700 beats 1500: delta = round(16 * 0.24) = 4
    const result = updateElo(1700, [1500], true, 16);
    expect(result.delta).toBe(4);
  });

  it('rounds delta to nearest integer (matches SQL ROUND)', () => {
    const result = updateElo(1500, [1510], true);
    expect(Number.isInteger(result.delta)).toBe(true);
    expect(Number.isInteger(result.newRating)).toBe(true);
  });
});

describe('elo.service — computeMatchUpdates', () => {
  it('returns equal-and-opposite deltas for equal-rated teams', () => {
    // 1500 vs 1500: both expected 0.5, winner +16, loser -16
    const result = computeMatchUpdates([1500], [1500], true);
    expect(result.homeDeltas).toEqual([16]);
    expect(result.awayDeltas).toEqual([-16]);
    expect(result.homeDeltas[0] + result.awayDeltas[0]).toBe(0);
  });

  it('applies same delta to all players on a side (team ELO)', () => {
    const result = computeMatchUpdates([1500, 1600], [1400, 1500], true);
    expect(result.homeDeltas[0]).toBe(result.homeDeltas[1]);
    expect(result.awayDeltas[0]).toBe(result.awayDeltas[1]);
  });

  it('handles away win (swap home/away deltas)', () => {
    const homeWin = computeMatchUpdates([1500], [1500], true);
    const awayWin = computeMatchUpdates([1500], [1500], false);
    expect(homeWin.homeDeltas[0]).toBe(-awayWin.homeDeltas[0]);
    expect(homeWin.awayDeltas[0]).toBe(-awayWin.awayDeltas[0]);
  });

  it('handles doubles (2v2)', () => {
    const result = computeMatchUpdates([1500, 1600], [1400, 1500], true);
    expect(result.homeDeltas).toHaveLength(2);
    expect(result.awayDeltas).toHaveLength(2);
  });
});

describe('elo.service — EloService class', () => {
  it('re-exports constants and pure functions as static members', () => {
    expect(EloService.DEFAULT_K_FACTOR).toBe(32);
    expect(EloService.DEFAULT_RATING).toBe(1200);
    expect(EloService.updateElo).toBe(updateElo);
    expect(EloService.computeMatchUpdates).toBe(computeMatchUpdates);
  });
});

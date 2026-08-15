import { describe, it, expect } from 'vitest';
import { balancedSliceSizes, scorePlan } from '@/lib/season-planning/clustering-utils';
import type { ClusteringMetrics } from '@/lib/season-planning/types';

describe('balancedSliceSizes', () => {
  it('verteilt gleichmäßig statt einen Rest übrig zu lassen', () => {
    expect(balancedSliceSizes(7, 6)).toEqual([4, 3]);
    expect(balancedSliceSizes(13, 6)).toEqual([5, 4, 4]);
  });

  it('hält die Obergrenze ein und verliert niemanden', () => {
    for (let total = 0; total <= 40; total++) {
      for (const maxSize of [1, 2, 4, 6, 8]) {
        const sizes = balancedSliceSizes(total, maxSize);
        expect(sizes.reduce((a, b) => a + b, 0)).toBe(total);
        for (const s of sizes) {
          expect(s).toBeLessThanOrEqual(maxSize);
          expect(s).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('scorePlan', () => {
  const base: ClusteringMetrics = {
    totalMembers: 10,
    totalGroups: 2,
    totalTrainers: 1,
    avgNiveauMatch: 80,
    niveauSpanViolations: 0,
    wishPartnerRequests: 0,
    wishPartnerFulfilled: 0,
    wishPartnerRate: 0,
    avgTrainerUtilization: 50,
    trainerOverloadWarnings: 0,
    highRiskSlotsUsed: 0,
    totalWaitlisted: 0,
    runtimeMs: 0,
    iterations: 2,
  };

  it('bewertet mehr zugewiesene Mitglieder höher als jeden Komfort-Bonus', () => {
    const wenigerZugewiesen = scorePlan({ ...base, wishPartnerRate: 100 }, 1);
    const mehrZugewiesen = scorePlan(base, 0);
    expect(mehrZugewiesen).toBeGreaterThan(wenigerZugewiesen);
  });

  it('bestraft überlastete Trainer und Niveau-Verstöße', () => {
    expect(scorePlan({ ...base, trainerOverloadWarnings: 1 }, 0)).toBeLessThan(scorePlan(base, 0));
    expect(scorePlan({ ...base, niveauSpanViolations: 1 }, 0)).toBeLessThan(scorePlan(base, 0));
  });
});

'use client';

/**
 * PremiumUpsellTrigger — self-mounting wrapper that opens {@link PremiumUpsell}
 * after the user's first lock-step on a season (Q1 Epic 1.2 — KI-Premium-Sichtbarkeit).
 *
 * Drop into the planning page with two props; the component:
 *   1. Reads the club's feature flags via {@link useClubFeatures}.
 *   2. Decides tier via {@link isStarterTier} (from analytics, Q1.2.1).
 *   3. Once `maxReachedStep >= 2` AND it has not yet fired this session,
 *      re-runs the dry-run through the public API and pushes the resulting
 *      {@link RoiStats} into the modal.
 *   4. Records "shown" in `sessionStorage` so it never re-triggers for the same
 *      season within the same browser session (per the ticket: "nach erstem
 *      Lock-Step", i.e. once is enough).
 *
 * Cost-of-life treatment: the modal is sugar, not a gate. We *swallow* fetch
 * errors silently — the modal is a marketing nudge, never a publish blocker.
 *
 * Why a separate trigger component? Keeps `plan-edit-step.tsx` diff minimal
 * (one line: `<PremiumUpsellTrigger ... />`) and isolates the feature-flag
 * fetch + dry-run re-fetch into one place that's easy to test + remove later.
 */

import { useEffect, useState, useMemo } from 'react';
import { PremiumUpsell } from '@/components/season-planning/premium-upsell';
import {
  computeRoiStats,
  isStarterTier,
  type RoiInput,
  type RoiStats,
} from '@/lib/season-planning/analytics';
import { useClubFeatures } from '@/hooks/use-club-features';
import { apiFetch } from '@/lib/api-fetch';

export interface PremiumUpsellTriggerProps {
  /** The season whose first lock-step we observe. */
  seasonId: string;
  /**
   * Wizard step the user has unlocked.
   * The wizard exposes `maxReachedStep`; we trigger when it reaches the
   * lock-step (= 2 in the current 2-step wizard layout).
   */
  maxReachedStep: number;
  /**
   * Cost-of-life: don't show the upsell while the user is actively publishing
   * (e.g. parent disables this while a confirm/POST is in flight).
   */
  disabled?: boolean;
  /**
   * Override the pricing href shown in the modal CTA. Defaults to `/pricing`
   * (the canonical landing page from ticket 1.2.3, currently a 404 — acceptable
   * for an opt-in kicker).
   */
  pricingHref?: string;
}

/**
 * Mounts the upsell modal. Renders no DOM when conditions are not met.
 */
export function PremiumUpsellTrigger({
  seasonId,
  maxReachedStep,
  disabled,
  pricingHref,
}: PremiumUpsellTriggerProps) {
  const { features } = useClubFeatures();
  const [stats, setStats] = useState<RoiStats | null>(null);
  const [open, setOpen] = useState(false);

  const isStarter = useMemo(() => isStarterTier(features), [features]);

  useEffect(() => {
    if (disabled || !isStarter) return;
    if (maxReachedStep < 2) return;
    if (typeof window === 'undefined') return;

    const seenKey = `swingz:premium-upsell:${seasonId}:shown`;
    if (window.sessionStorage.getItem(seenKey) === '1') return;

    let cancelled = false;
    void apiFetch(`/api/seasons/${seasonId}/planning/dry-run`, { method: 'POST' })
      .then(async (res) => {
        const report: { ok?: boolean } & Record<string, unknown> = await res.json();
        if (cancelled) return;
        // Mark "attempted" regardless of outcome: prevents a retry-storm
        // when the dry-run keeps failing (flaky network, server 500, 401)
        // and stops the modal from re-firing on every page revisit.
        window.sessionStorage.setItem(seenKey, '1');
        if (report?.ok) {
          // `RoiInput` is the structurally-identical input contract used by
          // `computeRoiStats`. The DryRunReport JSON shape satisfies it 1:1;
          // the `unknown` indirection acknowledges the cross-tier decode.
          const statsFromReport = computeRoiStats(report as unknown as RoiInput);
          setStats(statsFromReport);
          setOpen(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Same dedupe-on-attempt as the .then branch — modal is sugar, not a gate.
        window.sessionStorage.setItem(seenKey, '1');
      });

    return () => {
      cancelled = true;
    };
  }, [disabled, isStarter, maxReachedStep, seasonId]);

  if (!stats) return null;
  return (
    <PremiumUpsell
      open={open}
      onClose={() => setOpen(false)}
      stats={stats}
      {...(pricingHref ? { pricingHref } : {})}
    />
  );
}

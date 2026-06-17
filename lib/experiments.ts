'use client';

import { useState, useEffect } from 'react';

/**
 * Simple A/B testing framework.
 *
 * Experiments are defined in `experiments` object below.
 * Variants are assigned deterministically based on a stable ID (user ID, anonymous ID).
 *
 * Usage:
 *   import { useExperiment } from '@/lib/experiments';
 *   const { variant, loading } = useExperiment('homepage_hero', userId);
 */

export interface ExperimentDefinition {
  key: string;
  variants: string[];
  weights?: number[]; // percentage weights summing to 1, e.g., [0.5, 0.5]
  enabled: boolean;
}

// Experiment definitions
export const experiments: Record<string, ExperimentDefinition> = {
  /**
   * Landing page hero CTA text test.
   * Goal: measure which CTA phrasing drives more trial-training signups.
   * Variants are consumed in the landing page hero component.
   */
  landing_hero_cta: {
    key: 'landing_hero_cta',
    variants: ['demo_starten', 'kostenlos_testen'],
    weights: [0.5, 0.5],
    enabled: true,
  },

  /**
   * Register page CTA text test.
   * Goal: measure which phrasing drives more completed registrations.
   */
  register_cta: {
    key: 'register_cta',
    variants: ['verein_erstellen', 'kostenlos_registrieren'],
    weights: [0.5, 0.5],
    enabled: true,
  },

  /**
   * Pricing section layout test.
   * Goal: measure which pricing presentation drives more clicks.
   */
  pricing_layout: {
    key: 'pricing_layout',
    variants: ['cards', 'comparison_table'],
    weights: [0.5, 0.5],
    enabled: false,
  },

  /**
   * Onboarding flow length test.
   * Goal: measure completion rate with shorter vs. longer onboarding.
   */
  onboarding_flow: {
    key: 'onboarding_flow',
    variants: ['quick_3_step', 'detailed_5_step'],
    weights: [0.5, 0.5],
    enabled: true,
  },
};

/**
 * Generate a stable bucket number [0,1) from a string ID using a simple hash.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Normalize to [0, 1)
  return (Math.abs(hash) % 10000) / 10000;
}

/**
 * Get the assigned variant for an experiment.
 * If the experiment is not defined or disabled, returns the first variant (control).
 * If no id provided, uses a random but stable per-session fallback.
 */
export function getVariant(experimentKey: string, id?: string): string | null {
  const experiment = experiments[experimentKey];
  if (!experiment || !experiment.enabled) {
    return null;
  }

  const bucketId = id ?? getAnonymousId();
  const rng = hashString(bucketId);
  const weights = experiment.weights;

  if (!weights || weights.length === 0) {
    // Equal distribution
    const variantIndex = Math.floor(rng * experiment.variants.length);
    return experiment.variants[variantIndex];
  } else {
    // Weighted distribution
    let cumulative = 0;
    for (let i = 0; i < experiment.variants.length; i++) {
      cumulative += weights[i] ?? 0;
      if (rng <= cumulative) {
        return experiment.variants[i];
      }
    }
    return experiment.variants[experiment.variants.length - 1];
  }
}

/**
 * Hook helper for React components.
 * Returns the current variant for an experiment, re-evaluated when userId changes.
 */
export function useExperiment(experimentKey: string, id?: string) {
  const [variant, setVariant] = useState<string | null>(null);

  useEffect(() => {
    setVariant(getVariant(experimentKey, id));
  }, [experimentKey, id]);

  return {
    variant,
    isControl: variant === experiments[experimentKey]?.variants[0],
    isLoading: variant === null,
  };
}

/**
 * Generate/get an anonymous ID from localStorage or cookie.
 * Used when user is not logged in.
 */
function getAnonymousId(): string {
  if (typeof window === 'undefined') {
    return 'ssr-anon';
  }
  const storageKey = 'swingz_anon_id';
  let anonId = window.localStorage.getItem(storageKey);
  if (!anonId) {
    anonId = 'anon_' + Math.random().toString(36).substring(2, 15);
    window.localStorage.setItem(storageKey, anonId);
  }
  return anonId;
}

/**
 * Track conversion for an experiment variant.
 * This sends an analytics event with experiment details.
 */
export function trackConversion(
  experimentKey: string,
  value: number = 1,
  properties?: Record<string, unknown>
): void {
  // Import lazily to avoid circular
  const { trackEvent } = require('@/lib/analytics');
  trackEvent('experiment_conversion', {
    experiment_key: experimentKey,
    ...properties,
    value,
  });
}

/**
 * Activate an experiment (server-side flag for future experiments list).
 * In prod, enabled experiments are controlled via environment or feature flags.
 */
export function isExperimentEnabled(key: string): boolean {
  // Can be overridden by env variable like NEXT_PUBLIC_EXPERIMENTS=landing_hero_cta:pricing_layout
  const enabledList = process.env.NEXT_PUBLIC_EXPERIMENTS?.split(',') ?? [];
  if (enabledList.includes(key)) {
    return true;
  }
  const def = experiments[key];
  return def?.enabled ?? false;
}

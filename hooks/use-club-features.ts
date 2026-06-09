'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-fetch';
import type { FeatureKey } from '@/lib/features';
import { CLUB_FEATURES, getDefaultFeatures, sanitizeFeatureFlags } from '@/lib/features';

interface UseClubFeaturesResult {
  /** Feature-key → enabled map. */
  features: Record<string, boolean>;
  /** True until the first fetch completes. */
  loading: boolean;
  /** Last error message, or null. */
  error: string | null;
  /** True if the feature is enabled (defaults to false while loading). */
  isEnabled: (key: FeatureKey) => boolean;
  /** Optimistically toggle a feature and persist it. */
  toggle: (key: FeatureKey, value?: boolean) => Promise<boolean>;
  /** Persist the entire feature map (used by settings save button). */
  save: (next: Record<string, boolean>) => Promise<boolean>;
  /** True if any save/toggle is in flight. */
  saving: boolean;
}

/**
 * Fetch and mutate the active club's feature flags.
 * Pass the active clubId; if omitted, the hook is a no-op.
 */
export function useClubFeatures(clubId?: string | null): UseClubFeaturesResult {
  const [features, setFeatures] = useState<Record<string, boolean>>(() => getDefaultFeatures());
  const [loading, setLoading] = useState<boolean>(Boolean(clubId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch on mount / when clubId changes
  useEffect(() => {
    if (!clubId) {
      setFeatures(getDefaultFeatures());
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    apiFetch(`/api/clubs/${clubId}/features`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        setFeatures(sanitizeFeatureFlags(data?.features));
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          setError(err?.message ?? 'Failed to load features');
          setFeatures(getDefaultFeatures());
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [clubId]);

  const isEnabled = useCallback((key: FeatureKey) => Boolean(features[key]), [features]);

  const toggle = useCallback(
    async (key: FeatureKey, value?: boolean) => {
      if (!clubId) return false;
      const feature = CLUB_FEATURES.find((f) => f.key === key);
      if (feature?.category === 'core') {
        // Core features are immutable.
        return false;
      }
      const next = !features[key];
      const target = typeof value === 'boolean' ? value : next;
      const optimistic = { ...features, [key]: target };
      setFeatures(optimistic);
      setSaving(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/clubs/${clubId}/features`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(optimistic),
        });
        if (!res.ok) {
          // Revert on failure.
          setFeatures(features);
          const err = await res.json().catch(() => ({}));
          setError(err?.error ?? `HTTP ${res.status}`);
          return false;
        }
        const data = await res.json();
        setFeatures(sanitizeFeatureFlags(data?.features));
        return true;
      } catch (err: any) {
        setFeatures(features);
        setError(err?.message ?? 'Network error');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [clubId, features]
  );

  const save = useCallback(
    async (next: Record<string, boolean>) => {
      if (!clubId) return false;
      const sanitized = sanitizeFeatureFlags(next);
      setFeatures(sanitized);
      setSaving(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/clubs/${clubId}/features`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sanitized),
        });
        if (!res.ok) {
          setFeatures(features);
          const err = await res.json().catch(() => ({}));
          setError(err?.error ?? `HTTP ${res.status}`);
          return false;
        }
        const data = await res.json();
        setFeatures(sanitizeFeatureFlags(data?.features));
        return true;
      } catch (err: any) {
        setFeatures(features);
        setError(err?.message ?? 'Network error');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [clubId, features]
  );

  return { features, loading, error, isEnabled, toggle, save, saving };
}

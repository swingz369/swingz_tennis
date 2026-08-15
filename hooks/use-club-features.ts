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
 * Jede Komponente, die diesen Hook aufruft, hält ihren eigenen State — Sidebar
 * und Einstellungsseite sind zwei getrennte Instanzen. Ohne Benachrichtigung
 * merkte die Sidebar deshalb nichts davon, dass der Admin gerade ein Modul
 * ein- oder ausgeschaltet hat; die Navigation stimmte erst nach einem Reload.
 *
 * Statt einer Zustandsbibliothek genügt ein Fenster-Event: wer speichert,
 * ruft es aus, alle Instanzen desselben Vereins übernehmen den neuen Stand.
 */
const FEATURES_UPDATED_EVENT = 'swingz:club-features-updated';

function broadcastFeatures(clubId: string, features: Record<string, boolean>): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FEATURES_UPDATED_EVENT, { detail: { clubId, features } }));
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

  // Änderungen einer anderen Instanz übernehmen (siehe FEATURES_UPDATED_EVENT).
  useEffect(() => {
    if (!clubId || typeof window === 'undefined') return;
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        { clubId?: string; features?: Record<string, boolean> } | undefined;
      if (detail?.clubId !== clubId) return;
      setFeatures(sanitizeFeatureFlags(detail.features));
    };
    window.addEventListener(FEATURES_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(FEATURES_UPDATED_EVENT, onUpdate);
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
        const persisted = sanitizeFeatureFlags(data?.features);
        setFeatures(persisted);
        broadcastFeatures(clubId, persisted);
        return true;
      } catch (err) {
        setFeatures(features);
        setError(err instanceof Error ? err.message : 'Netzwerkfehler');
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
        const persisted = sanitizeFeatureFlags(data?.features);
        setFeatures(persisted);
        // Sidebar & Co. sofort mitziehen — ohne das bräuchte es ein F5.
        broadcastFeatures(clubId, persisted);
        return true;
      } catch (err) {
        setFeatures(features);
        setError(err instanceof Error ? err.message : 'Netzwerkfehler');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [clubId, features]
  );

  return { features, loading, error, isEnabled, toggle, save, saving };
}

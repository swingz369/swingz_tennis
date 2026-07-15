'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Loader2,
  Sparkles,
  Lock,
  CheckCircle2,
  ShoppingBag,
  Trophy,
  FlaskConical,
  Users,
  GraduationCap,
  CalendarDays,
  DollarSign,
} from 'lucide-react';
import type { FeatureKey } from '@/lib/features';
import { CLUB_FEATURES, getDefaultFeatures, sanitizeFeatureFlags } from '@/lib/features';
import { apiFetch } from '@/lib/api-fetch';

interface ModuleSelectionStepProps {
  clubId: string;
  /** Called after the user successfully saves the selection. */
  onSaved?: (features: Record<string, boolean>) => void;
  /** If true, shows a save button. If false, the parent wizard handles save. */
  showContinue?: boolean;
  /** Optional initial values (for settings tab re-render). */
  initialFeatures?: Record<string, boolean>;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Users,
  GraduationCap,
  CalendarDays,
  DollarSign,
  ShoppingBag,
  Trophy,
  FlaskConical,
  Sparkles,
};

/**
 * Reusable module-selection card grid.
 * Used in:
 *  - Onboarding wizard step 2 (after Verein / Club data)
 *  - Settings → Module tab
 */
export function ModuleSelectionStep({
  clubId,
  onSaved,
  showContinue = true,
  initialFeatures,
}: ModuleSelectionStepProps) {
  const [features, setFeatures] = useState<Record<string, boolean>>(
    () => initialFeatures ?? getDefaultFeatures()
  );
  const [loading, setLoading] = useState<boolean>(!initialFeatures);
  const [saving, setSaving] = useState(false);

  // Load on mount (skipped if initialFeatures provided)
  useEffect(() => {
    if (initialFeatures) return;
    const controller = new AbortController();
    setLoading(true);
    apiFetch(`/api/clubs/${clubId}/features`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => setFeatures(sanitizeFeatureFlags(data?.features)))
      .catch(() => setFeatures(getDefaultFeatures()))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [clubId, initialFeatures]);

  const handleToggle = (key: FeatureKey) => {
    const feature = CLUB_FEATURES.find((f) => f.key === key);
    if (feature?.category === 'core') {
      toast.info('Grundfunktionen sind immer aktiv.');
      return;
    }
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/clubs/${clubId}/features`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(features),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error ?? 'Fehler beim Speichern');
        return;
      }
      const data = await res.json();
      const saved = sanitizeFeatureFlags(data?.features);
      setFeatures(saved);
      toast.success('Module gespeichert');
      onSaved?.(saved);
    } catch {
      toast.error('Netzwerkfehler');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
      </div>
    );
  }

  const coreFeatures = CLUB_FEATURES.filter((f) => f.category === 'core');
  const optionalFeatures = CLUB_FEATURES.filter((f) => f.category === 'optional');

  const renderCard = (feature: (typeof CLUB_FEATURES)[number]) => {
    const enabled = features[feature.key];
    const isCore = feature.category === 'core';
    const Icon = ICON_MAP[feature.icon] ?? Sparkles;

    return (
      <Card
        key={feature.key}
        className={`relative cursor-pointer transition-all duration-200 ${
          enabled
            ? 'border-brand-primary bg-brand-primary/5 shadow-sm'
            : 'border-border hover:border-brand-primary/40 hover:shadow-sm'
        }`}
        onClick={() => handleToggle(feature.key as FeatureKey)}
        role="button"
        tabIndex={0}
        aria-pressed={enabled}
        aria-label={`${feature.label} – ${enabled ? 'aktiviert' : 'deaktiviert'}`}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            handleToggle(feature.key as FeatureKey);
          }
        }}
      >
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                enabled ? 'bg-brand-primary text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{feature.label}</h3>
                {isCore && (
                  <span className="inline-flex items-center gap-1 text-2xs font-medium uppercase tracking-wider text-brand-primary bg-brand-primary/10 px-1.5 py-0.5 rounded">
                    <Lock className="h-2.5 w-2.5" />
                    Pflicht
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {feature.description}
              </p>
            </div>
            <div
              className={`shrink-0 w-10 h-5 rounded-full transition-colors ${
                enabled ? 'bg-brand-primary' : 'bg-muted'
              } relative`}
            >
              <div
                className={`absolute top-0.5 ${
                  enabled ? 'right-0.5' : 'left-0.5'
                } w-4 h-4 bg-white rounded-full shadow transition-all`}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-info-50/50 border border-info-200 rounded-xl p-4 text-sm text-info-800 flex gap-2.5">
        <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <strong>Wähle die Module aus, die du nutzen möchtest.</strong> Du kannst sie später
          jederzeit in den <em>Einstellungen → Module</em> ändern.
          <br />
          <span className="text-xs text-info-700/80">
            Grundfunktionen (Mitgliederverwaltung, Trainer, Saisonplanung, Finanzen) sind immer
            aktiv.
          </span>
        </div>
      </div>

      {/* Core features */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Grundfunktionen
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{coreFeatures.map(renderCard)}</div>
      </div>

      {/* Optional features */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Optionale Module
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {optionalFeatures.map(renderCard)}
        </div>
      </div>

      {showContinue && (
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-brand-primary hover:bg-brand-primary/90 text-white"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Auswahl speichern
          </Button>
        </div>
      )}
    </div>
  );
}

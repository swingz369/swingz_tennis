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
  Shuffle,
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
  /** Beschriftung des Save-Buttons — im Wizard ist er zugleich der Weiter-Button. */
  continueLabel?: string;
  /** Optional initial values (for settings tab re-render). */
  initialFeatures?: Record<string, boolean>;
  /**
   * Jeder Klick schreibt sofort. Default an — nur der Onboarding-Wizard
   * schaltet das ab, weil er die Auswahl zusammen mit dem Schritt speichert.
   */
  autoSave?: boolean;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Users,
  GraduationCap,
  CalendarDays,
  DollarSign,
  ShoppingBag,
  Trophy,
  FlaskConical,
  Shuffle,
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
  continueLabel = 'Auswahl speichern',
  initialFeatures,
  autoSave = true,
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

  /**
   * Umschalten speichert sofort (außer im Onboarding-Wizard, der die Auswahl
   * am Ende gebündelt schreibt).
   *
   * Vorher änderte ein Klick nur den lokalen State: Das Modul sah aktiviert
   * aus, in `clubs.features` stand aber weiter nichts — und die Navigation
   * blendete den Bereich aus. Wer den „Speichern"-Knopf übersah (im
   * Einstellungen-Tab steht er unter der Kachelliste), hatte ein Modul, das
   * angeblich an ist und nirgends auftaucht.
   */
  const handleToggle = async (key: FeatureKey) => {
    const feature = CLUB_FEATURES.find((f) => f.key === key);
    if (feature?.category === 'core') {
      toast.info('Grundfunktionen sind immer aktiv.');
      return;
    }

    const next = { ...features, [key]: !features[key] };
    setFeatures(next);
    if (!autoSave) return;

    setSaving(true);
    try {
      const res = await apiFetch(`/api/clubs/${clubId}/features`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFeatures(features); // zurückdrehen — sonst lügt die Oberfläche
        toast.error(err?.error ?? 'Modul konnte nicht gespeichert werden');
        return;
      }
      const data = await res.json();
      const saved = sanitizeFeatureFlags(data?.features);
      setFeatures(saved);
      toast.success(
        `${feature?.label ?? 'Modul'} ${saved[key] ? 'aktiviert' : 'deaktiviert'} — die Navigation aktualisiert sich beim nächsten Seitenwechsel.`
      );
      onSaved?.(saved);
    } catch {
      setFeatures(features);
      toast.error('Netzwerkfehler — Modul nicht gespeichert');
    } finally {
      setSaving(false);
    }
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
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
            ? 'border-primary bg-primary/5 shadow-sm'
            : 'border-border hover:border-primary/40 hover:shadow-sm'
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
                enabled ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              {/* flex-wrap: in der schmalen Zwei-Spalten-Kachel passen lange
                  Labels wie "Mitgliederverwaltung" nicht neben das Badge —
                  ohne Umbruch schob es sich über den Toggle. */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {/* break-words: "Mitgliederverwaltung" ist ein einzelnes Wort
                    und wurde in der schmalen Kachel sonst abgeschnitten. */}
                <h3 className="font-semibold text-foreground break-words">{feature.label}</h3>
                {isCore && (
                  <span className="inline-flex items-center gap-1 text-2xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
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
                enabled ? 'bg-primary' : 'bg-muted'
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
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">Grundfunktionen</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{coreFeatures.map(renderCard)}</div>
      </div>

      {/* Optional features */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">Optionale Module</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {optionalFeatures.map(renderCard)}
        </div>
      </div>

      {showContinue && (
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            {continueLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

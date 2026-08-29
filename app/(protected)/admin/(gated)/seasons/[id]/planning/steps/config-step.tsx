'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useWizard } from '@/lib/season-planning/wizard-context';
import ScheduleReadinessCheck from '@/lib/season-planning/readiness-check';
import { MemberSelector } from './member-selector';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SeasonBillingConfig } from '@/lib/billing/season-billing.service';
import type { PreferencesSummary } from '@/lib/season-planning/types';
import { apiFetch } from '@/lib/api-fetch';
import {
  Settings,
  Users,
  Gauge,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  Zap,
  Baby,
  Clock,
  Euro,
  Receipt,
  Percent,
  CalendarDays,
  Save,
  Loader2,
  Mail,
  Copy,
  ChevronDown,
} from 'lucide-react';

function PreferencesStatusCard({
  seasonId,
  onSummary,
}: {
  seasonId: string;
  onSummary: (summary: PreferencesSummary) => void;
}) {
  const [summary, setSummary] = useState<PreferencesSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/seasons/${seasonId}/planning/preferences-summary`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.summary) return;
        setSummary(data.summary);
        onSummary(data.summary);
      })
      .catch((err) => {
        console.error('Trainings-Präferenzen konnten nicht geladen werden', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonId]);

  if (loading) return null;
  if (!summary || summary.totalMembers === 0) return null;

  const hasWarnings =
    summary.slotFailureWarnings.length > 0 || summary.incompatibleWishPartners.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Präferenzen-Status
        </CardTitle>
        <CardDescription>
          {summary.submittedCount} von {summary.totalMembers} Mitgliedern eingereicht (
          {Math.round(summary.responseRate)}%)
        </CardDescription>
      </CardHeader>
      {hasWarnings && (
        <CardContent className="space-y-2">
          {summary.slotFailureWarnings.map((w, i) => (
            <div
              key={`slot-${i}`}
              className="flex items-start gap-2 text-sm text-warning-700 dark:text-warning-400"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{w.warning}</span>
            </div>
          ))}
          {summary.incompatibleWishPartners.map((p, i) => (
            <div
              key={`wish-${i}`}
              className="flex items-start gap-2 text-sm text-warning-700 dark:text-warning-400"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Wunschpartner-Konflikt: {p.memberA.name} &amp; {p.memberB.name} — {p.reason}
              </span>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function RemindButton({ seasonId }: { seasonId: string }) {
  const [sending, setSending] = useState(false);
  const send = useCallback(async () => {
    setSending(true);
    try {
      const res = await apiFetch(`/api/seasons/${seasonId}/planning/remind`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      toast.success(`Erinnerung gesendet an ${data.sent ?? 0} Mitglieder ohne Präferenzen`);
    } catch {
      toast.error('Erinnerung konnte nicht gesendet werden');
    } finally {
      setSending(false);
    }
  }, [seasonId]);

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Mail className="h-4 w-4" />
        Mitglieder ohne Präferenzen per E-Mail erinnern
      </div>
      <Button variant="outline" size="sm" onClick={send} disabled={sending} className="gap-1.5">
        {sending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Mail className="h-3.5 w-3.5" />
        )}
        Erinnerung senden
      </Button>
    </div>
  );
}

interface CopyGroupsSeasonSummary {
  id: string;
  name: string;
  season_type: string;
  year: number;
  planning_status: string;
}

function CopyGroupsPanel({ seasonId, clubId }: { seasonId: string; clubId: string }) {
  const [seasons, setSeasons] = useState<CopyGroupsSeasonSummary[]>([]);
  const [loadingSeasons, setLoadingSeasons] = useState(true);
  const [sourceSeasonId, setSourceSeasonId] = useState('');
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/seasons?clubId=${clubId}`);
        if (res.ok) {
          const data = await res.json();
          const all: CopyGroupsSeasonSummary[] = data.seasons ?? data ?? [];
          const candidates = all
            .filter(
              (s) =>
                s.id !== seasonId &&
                ['published', 'active', 'completed', 'archived'].includes(s.planning_status)
            )
            .slice(0, 3);
          if (!cancelled) setSeasons(candidates);
        }
      } finally {
        if (!cancelled) setLoadingSeasons(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clubId, seasonId]);

  const handleCopy = async () => {
    if (!sourceSeasonId) return;
    setCopying(true);
    try {
      const res = await apiFetch(`/api/seasons/${seasonId}/copy-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceSeasonId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(extractErrorMessage(data) ?? 'Fehler beim Übernehmen des Stundenplans');
        return;
      }
      toast.success(
        `${data.copiedEntries} Stundenplan-Eintr${data.copiedEntries !== 1 ? 'äge' : 'ag'} aus ${data.copiedGroups} Gruppe${data.copiedGroups !== 1 ? 'n' : ''} übernommen.`
      );
      setSourceSeasonId('');
    } catch {
      toast.error('Netzwerkfehler beim Kopieren');
    } finally {
      setCopying(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Copy className="h-4 w-4 text-primary" />
          Stundenplan aus vorheriger Saison übernehmen
        </CardTitle>
        <CardDescription>
          Übernimmt die Belegung einer abgeschlossenen Saison — wer unterrichtet wann, wo, mit
          welcher Gruppe — als Entwurf in diese Saison. Ohne Neu-Clustering.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingSeasons ? (
          <p className="text-sm text-muted-foreground">Lade Saisons…</p>
        ) : seasons.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine abgeschlossenen Saisons als Quelle verfügbar.
          </p>
        ) : (
          <>
            <div className="rounded-md border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800 dark:border-warning-800 dark:bg-warning-900 dark:text-warning-200">
              Nur in eine Saison ohne eigenen Stundenplan. Hat diese Saison schon Einträge, wird
              nichts übernommen — erst leeren, dann kopieren.
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label htmlFor="source-season">Saison als Vorlage wählen</Label>
                <Select value={sourceSeasonId} onValueChange={setSourceSeasonId}>
                  <SelectTrigger id="source-season" className="mt-1">
                    <SelectValue placeholder="Saison auswählen…" />
                  </SelectTrigger>
                  <SelectContent>
                    {seasons.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.year})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleCopy}
                disabled={copying || !sourceSeasonId}
                className="shrink-0"
              >
                {copying ? (
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                Gruppen übernehmen
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * ConfigStep (Schritt 1 von 4)
 *
 * Responsibilities:
 * 1. Readiness Check: Verify all prerequisites are met
 * 2. Preference Reminders: Email members/trainers without preferences
 * 3. Planning Config: Set algorithm parameters (group sizes, trainer util, etc.)
 * 4. Auto-Plan Goals: Choose optimization objectives (conflicts, load, preferences)
 * 5. AI Features: Toggle AI optimization (Gemini)
 * 6. Member Selection: Choose which members to plan for
 * 7. Trainer Availability: Review trainer load & submission status
 * 8. Billing Config: Set hourly rates, membership fees, tax rates
 *
 * Gate to next step: readiness check must pass (isReady = true)
 */
export function ConfigStep({ aiAvailable = true }: { aiAvailable?: boolean }) {
  const { state, dispatch } = useWizard();
  const [config, setConfig] = useState(state.planningConfig);

  // Billing config state
  const [billingConfig, setBillingConfig] = useState<Partial<SeasonBillingConfig>>({
    trainer_hourly_rate: 50,
    use_trainer_profile_rate: false,
    include_membership_fee: true,
    membership_fee_amount: null,
    membership_fee_type: 'yearly',
    payment_terms_days: 30,
    tax_rate: 0,
  });
  const [billingFetched, setBillingFetched] = useState(false);
  const [billingSaving, setBillingSaving] = useState(false);

  // Fetch existing billing config on mount
  useEffect(() => {
    if (billingFetched) return;
    setBillingFetched(true);
    apiFetch(`/api/seasons/${state.seasonId}/billing`)
      .then((res) => res.json())
      .then((data) => {
        if (data.config) {
          setBillingConfig((prev) => ({
            ...prev,
            ...data.config,
          }));
        }
      })
      .catch(() => {
        // Keep defaults if fetch fails
      });
  }, [state.seasonId, billingFetched]);

  const handleBillingSave = useCallback(async () => {
    setBillingSaving(true);
    try {
      const res = await apiFetch(`/api/seasons/${state.seasonId}/billing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billingConfig),
      });
      if (res.ok) {
        toast.success('Abrechnungseinstellungen gespeichert');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(extractErrorMessage(err) ?? 'Fehler beim Speichern');
      }
    } catch {
      toast.error('Netzwerkfehler');
    } finally {
      setBillingSaving(false);
    }
  }, [state.seasonId, billingConfig]);

  const handleConfigChange = (key: string, value: number | boolean) => {
    const next = { ...config, [key]: value };
    setConfig(next);
    dispatch({ type: 'SET_PLANNING_CONFIG', config: next });
  };

  return (
    <div className="space-y-6">
      {/* Readiness Check — placed prominently at top */}
      <ScheduleReadinessCheck
        clubId={state.clubId}
        seasonId={state.seasonId}
        onReady={(isReady) => dispatch({ type: 'SET_READY', isReady })}
      />

      {/* Präferenzen-Status — Response-Rate, Ausfallraten-Warnungen, Wunschpartner-Konflikte */}
      <PreferencesStatusCard
        seasonId={state.seasonId}
        onSummary={(summary) => dispatch({ type: 'SET_PREFERENCES_SUMMARY', summary })}
      />

      {/* Präferenz-Erinnerung */}
      <RemindButton seasonId={state.seasonId} />

      {/* Season Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            Planungseinstellungen
          </CardTitle>
          <CardDescription>Diese Einstellungen steuern den Clustering-Algorithmus</CardDescription>
        </CardHeader>
        <CardContent>
          {' '}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" /> Max. Gruppengröße (Erwachsene)
              </Label>
              <Input
                type="number"
                min={1}
                max={6}
                value={config.groupMaxSize}
                onChange={(e) => handleConfigChange('groupMaxSize', Number(e.target.value))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Min. Gruppengröße (Erwachsene)
              </Label>
              <Input
                type="number"
                min={1}
                max={6}
                value={config.groupMinSize}
                onChange={(e) => handleConfigChange('groupMinSize', Number(e.target.value))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Trainer-Auslastung max. %</Label>
              <Input
                type="number"
                min={50}
                max={100}
                value={config.trainerUtilizationMaxPct}
                onChange={(e) =>
                  handleConfigChange('trainerUtilizationMaxPct', Number(e.target.value))
                }
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Baby className="h-3 w-3" /> Max. Gruppengröße (Kinder)
              </Label>
              <Input
                type="number"
                min={2}
                max={10}
                value={config.kidsGroupMaxSize}
                onChange={(e) => handleConfigChange('kidsGroupMaxSize', Number(e.target.value))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Baby className="h-3 w-3" /> Min. Gruppengröße (Kinder)
              </Label>
              <Input
                type="number"
                min={1}
                max={6}
                value={config.kidsGroupMinSize}
                onChange={(e) => handleConfigChange('kidsGroupMinSize', Number(e.target.value))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Slot-Dauer (Minuten)
              </Label>
              <Input
                type="number"
                min={30}
                max={180}
                step={15}
                value={config.slotDurationMinutes}
                onChange={(e) => handleConfigChange('slotDurationMinutes', Number(e.target.value))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Max. Niveau-Stufen (1 = gleiches Level, 2 = ein Abstand)
              </Label>
              <Input
                type="number"
                min={0}
                max={3}
                value={config.maxNiveauLevelSteps}
                onChange={(e) => handleConfigChange('maxNiveauLevelSteps', Number(e.target.value))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Slot-Ausfallrate max. %</Label>
              <Input
                type="number"
                min={10}
                max={80}
                value={config.slotFailureThreshold}
                onChange={(e) => handleConfigChange('slotFailureThreshold', Number(e.target.value))}
                className="h-9"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.preferHistoricGroups}
                onChange={(e) => handleConfigChange('preferHistoricGroups', e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm text-foreground">Historische Gruppen bevorzugen</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.avoidHighFailureSlots}
                onChange={(e) => handleConfigChange('avoidHighFailureSlots', e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm text-foreground">Hohe Ausfallraten-Slots vermeiden</span>
            </label>
          </div>
          {/* Auto-Plan Options (integrated from /auto-plan page) */}
          <div className="mt-6 border-t pt-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-warning-500" />
              <span className="text-sm font-medium text-foreground">Auto-Plan Optimierung</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Max. Iterationen</Label>
                <Input
                  type="number"
                  min={100}
                  max={5000}
                  step={100}
                  value={config.maxIterations}
                  onChange={(e) => handleConfigChange('maxIterations', Number(e.target.value))}
                  className="h-9"
                />
                <p className="text-2xs text-muted-foreground">
                  Höhere Werte = bessere Ergebnisse, längere Laufzeit
                </p>
              </div>
            </div>

            <div className="space-y-3 mt-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="goal-minimize-conflicts"
                  checked={config.optimizationGoals.includes('minimize_conflicts')}
                  onChange={() => {
                    const goals = config.optimizationGoals.includes('minimize_conflicts')
                      ? config.optimizationGoals.filter((g) => g !== 'minimize_conflicts')
                      : [...config.optimizationGoals, 'minimize_conflicts'];
                    handleConfigChange('optimizationGoals' as any, goals as any);
                  }}
                  className="rounded border-border"
                />
                <label htmlFor="goal-minimize-conflicts" className="text-sm cursor-pointer">
                  Konflikte minimieren
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="goal-balance-trainers"
                  checked={config.optimizationGoals.includes('balance_trainer_load')}
                  onChange={() => {
                    const goals = config.optimizationGoals.includes('balance_trainer_load')
                      ? config.optimizationGoals.filter((g) => g !== 'balance_trainer_load')
                      : [...config.optimizationGoals, 'balance_trainer_load'];
                    handleConfigChange('optimizationGoals' as any, goals as any);
                  }}
                  className="rounded border-border"
                />
                <label htmlFor="goal-balance-trainers" className="text-sm cursor-pointer">
                  Trainer-Last ausgleichen
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="goal-maximize-prefs"
                  checked={config.optimizationGoals.includes('maximize_preferences')}
                  onChange={() => {
                    const goals = config.optimizationGoals.includes('maximize_preferences')
                      ? config.optimizationGoals.filter((g) => g !== 'maximize_preferences')
                      : [...config.optimizationGoals, 'maximize_preferences'];
                    handleConfigChange('optimizationGoals' as any, goals as any);
                  }}
                  className="rounded border-border"
                />
                <label htmlFor="goal-maximize-prefs" className="text-sm cursor-pointer">
                  Präferenzen maximieren
                </label>
              </div>
            </div>

            <div className="space-y-2.5 mt-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="use-ai"
                  checked={config.useAI}
                  onChange={(e) => handleConfigChange('useAI', e.target.checked)}
                  className="rounded border-border"
                />
                <label
                  htmlFor="use-ai"
                  className="text-sm cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5 text-warning-500" />
                  KI-Optimierung (Gemini)
                  {!aiAvailable && (
                    <span className="text-xs text-warning-600 ml-1">(nicht konfiguriert)</span>
                  )}
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="allow-overbooking"
                  checked={config.allowOverbooking}
                  onChange={(e) => handleConfigChange('allowOverbooking', e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="allow-overbooking" className="text-sm cursor-pointer">
                  Überbuchung erlauben
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="prefer-consistent"
                  checked={config.preferConsistentTimeslots}
                  onChange={(e) =>
                    handleConfigChange('preferConsistentTimeslots', e.target.checked)
                  }
                  className="rounded border-border"
                />
                <label htmlFor="prefer-consistent" className="text-sm cursor-pointer">
                  Konsistente Zeitslots bevorzugen
                </label>
              </div>
              <div className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  id="include-sunday"
                  checked={config.includeSunday}
                  onChange={(e) => handleConfigChange('includeSunday', e.target.checked)}
                  className="rounded border-border mt-0.5"
                />
                <label htmlFor="include-sunday" className="text-sm cursor-pointer">
                  Sonntag in die Planung einbeziehen
                  <span className="block text-xs text-muted-foreground font-normal mt-0.5">
                    Standardmäßig aus — Sonntag ist spielfrei (Vereinsrealität, Arbeits- &amp;
                    Ruhezeitregeln für Trainer). Nur aktivieren, wenn bewusst gewünscht.
                  </span>
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Erweiterte Einstellungen — selten benötigt, daher standardmäßig eingeklappt */}
      <details className="group rounded-xl border border-border bg-muted/20">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-foreground flex items-center gap-2">
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          Erweiterte Einstellungen (Gruppen aus Vorsaison übernehmen)
        </summary>
        <div className="px-4 pb-4 space-y-6">
          <CopyGroupsPanel seasonId={state.seasonId} clubId={state.clubId} />
        </div>
      </details>

      {/* Quick Stats */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">Ausgewählte Mitglieder</p>
            </div>
            <p className="text-xl font-bold mt-1">{state.selectedMemberIds.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-info-500" />
              <p className="text-xs text-muted-foreground">Trainer-Auslastung</p>
            </div>
            <p className="text-xl font-bold mt-1">
              {Object.keys(state.trainerUtilization).length > 0
                ? `${Math.round(
                    Object.values(state.trainerUtilization).reduce((s, t) => s + t.pct, 0) /
                      Math.max(1, Object.keys(state.trainerUtilization).length)
                  )}%`
                : '–'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              {state.isReady ? (
                <CheckCircle className="h-4 w-4 text-success-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-warning-500" />
              )}
              <p className="text-xs text-muted-foreground">Bereitschaft</p>
            </div>
            <p
              className={`text-xl font-bold mt-1              ${state.isReady ? 'text-success-600' : 'text-warning-600'}`}
            >
              {state.isReady ? 'Bereit' : 'Prüfen'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Billing Config — eingeklappt: eigenes Anliegen, nicht Teil des Clustering,
          gehört fachlich näher zur Abrechnungs-Vorschau in Schritt 4 ═══ */}
      <details className="group rounded-xl border border-border bg-muted/20">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-foreground flex items-center gap-2">
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          <Receipt className="h-4 w-4 text-primary" />
          Abrechnungseinstellungen (Stundensatz, Mitgliedsbeitrag, Zahlungsziel)
        </summary>
        <div className="px-4 pb-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardDescription>
                  Konfiguriere Stundensatz, Mitgliedsbeitrag &amp; Zahlungsziel für diese Saison
                </CardDescription>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={handleBillingSave}
                  disabled={billingSaving}
                >
                  {billingSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Speichern
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {/* Trainer hourly rate */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="billing-trainer-hourly-rate"
                    className="text-xs text-muted-foreground flex items-center gap-1"
                  >
                    <Euro className="h-3 w-3" />
                    Trainer-Stundensatz (€)
                  </Label>
                  <Input
                    id="billing-trainer-hourly-rate"
                    type="number"
                    min={0}
                    step={1}
                    value={billingConfig.trainer_hourly_rate ?? 50}
                    onChange={(e) =>
                      setBillingConfig((prev) => ({
                        ...prev,
                        trainer_hourly_rate: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="h-9"
                  />
                  <p className="text-2xs text-muted-foreground">
                    Standard-Stundensatz für alle Trainer
                  </p>
                </div>

                {/* Tax rate */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="billing-tax-rate"
                    className="text-xs text-muted-foreground flex items-center gap-1"
                  >
                    <Percent className="h-3 w-3" />
                    Umsatzsteuer (%)
                  </Label>
                  <Input
                    id="billing-tax-rate"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={billingConfig.tax_rate ?? 0}
                    onChange={(e) =>
                      setBillingConfig((prev) => ({
                        ...prev,
                        tax_rate: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="h-9"
                  />
                  <p className="text-2xs text-muted-foreground">
                    0 = steuerbefreit (Kleinunternehmer)
                  </p>
                </div>

                {/* Payment terms */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="billing-payment-terms"
                    className="text-xs text-muted-foreground flex items-center gap-1"
                  >
                    <CalendarDays className="h-3 w-3" />
                    Zahlungsziel (Tage)
                  </Label>
                  <Input
                    id="billing-payment-terms"
                    type="number"
                    min={0}
                    max={90}
                    step={1}
                    value={billingConfig.payment_terms_days ?? 30}
                    onChange={(e) =>
                      setBillingConfig((prev) => ({
                        ...prev,
                        payment_terms_days: parseInt(e.target.value) || 0,
                      }))
                    }
                    className="h-9"
                  />
                  <p className="text-2xs text-muted-foreground">
                    Tage bis zur Fälligkeit nach Rechnungsstellung
                  </p>
                </div>
              </div>

              {/* Checkboxes row */}
              <div className="flex flex-wrap items-center gap-6 mt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={billingConfig.use_trainer_profile_rate ?? false}
                    onChange={(e) =>
                      setBillingConfig((prev) => ({
                        ...prev,
                        use_trainer_profile_rate: e.target.checked,
                      }))
                    }
                    className="rounded border-border"
                  />
                  <span className="text-sm text-foreground">
                    Trainer-Profil-Stundensätze verwenden
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={billingConfig.include_membership_fee ?? true}
                    onChange={(e) =>
                      setBillingConfig((prev) => ({
                        ...prev,
                        include_membership_fee: e.target.checked,
                      }))
                    }
                    className="rounded border-border"
                  />
                  <span className="text-sm text-foreground">Mitgliedsbeitrag einbeziehen</span>
                </label>
              </div>

              {/* Membership fee details — conditional */}
              {billingConfig.include_membership_fee && (
                <div className="grid gap-4 md:grid-cols-3 mt-4 p-4 rounded-xl bg-muted/30 border border-border">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="billing-membership-amount"
                      className="text-xs text-muted-foreground"
                    >
                      Mitgliedsbeitrag (€)
                    </Label>
                    <Input
                      id="billing-membership-amount"
                      type="number"
                      min={0}
                      step={1}
                      placeholder="Leer = automatisch aus Beitragskategorien"
                      value={billingConfig.membership_fee_amount ?? ''}
                      onChange={(e) =>
                        setBillingConfig((prev) => ({
                          ...prev,
                          membership_fee_amount: e.target.value ? parseFloat(e.target.value) : null,
                        }))
                      }
                      className="h-9"
                    />
                    <p className="text-2xs text-muted-foreground">
                      Leer lassen für Auto-Erkennung aus Beitragskategorien
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="billing-membership-type"
                      className="text-xs text-muted-foreground"
                    >
                      Beitragstyp
                    </Label>
                    <Select
                      value={billingConfig.membership_fee_type ?? 'yearly'}
                      onValueChange={(v) =>
                        setBillingConfig((prev) => ({
                          ...prev,
                          membership_fee_type: v as SeasonBillingConfig['membership_fee_type'],
                        }))
                      }
                    >
                      <SelectTrigger id="billing-membership-type" className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yearly">Jährlich</SelectItem>
                        <SelectItem value="seasonal">Saisonal</SelectItem>
                        <SelectItem value="monthly">Monatlich</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-2xs text-muted-foreground">
                      Bestimmt die Beschreibung auf der Rechnung
                    </p>
                  </div>

                  <div className="flex items-end">
                    <p className="text-xs text-muted-foreground pb-2">
                      {billingConfig.membership_fee_amount != null
                        ? `Manuell: ${billingConfig.membership_fee_amount.toFixed(2)} €`
                        : 'Auto: Betrag aus Beitragskategorien'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </details>

      {/* Member Selector */}
      <MemberSelector />
    </div>
  );
}

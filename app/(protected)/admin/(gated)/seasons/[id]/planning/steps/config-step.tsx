'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState, useEffect, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';
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
import type { PreferencesSummary } from '@/lib/season-planning/types';
import { apiFetch } from '@/lib/api-fetch';
import {
  Settings,
  Users,
  Gauge,
  AlertTriangle,
  Zap,
  Baby,
  Clock,
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
            <div key={`slot-${i}`} className="flex items-start gap-2 text-sm text-warning-700">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{w.warning}</span>
            </div>
          ))}
          {summary.incompatibleWishPartners.map((p, i) => (
            <div key={`wish-${i}`} className="flex items-start gap-2 text-sm text-warning-700">
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
            <div className="rounded-md border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
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
 * 3. Planning Config: Gruppengrößen, Trainingsdauer, Sonntag — sichtbar.
 *    Algorithmus-Feinheiten (Niveau-Abstand, Auslastung, Iterationen,
 *    Optimierungsziele) eingeklappt; Defaults in `clustering-engine.ts`.
 * 4. Member Selection: Choose which members to plan for
 *
 * NICHT mehr hier: Abrechnung (Stundensatz, Mitgliedsbeitrag, Zahlungsziel).
 * Die steht bei den Saison-Einstellungen (/admin/seasons/:id/edit), weil sie
 * an genau einer Saison hängt; Schritt 4 verlinkt dorthin, wenn für die Saison
 * nichts hinterlegt ist.
 *
 * Gate to next step: readiness check must pass (isReady = true)
 */
/** Ein Zahlenfeld der Planungseinstellungen — neunmal dasselbe Markup. */
function NumField({
  label,
  hint,
  icon: Icon,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  hint?: string;
  icon?: LucideIcon;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </Label>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9"
      />
      {hint && <p className="text-2xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const OPTIMIZATION_GOALS = [
  { id: 'minimize_conflicts', label: 'Konflikte minimieren' },
  { id: 'balance_trainer_load', label: 'Trainer-Last ausgleichen' },
  { id: 'maximize_preferences', label: 'Präferenzen maximieren' },
] as const;

const BOOLEAN_OPTIONS = [
  { key: 'preferHistoricGroups', label: 'Bewährte Gruppen aus der Vorsaison bevorzugen' },
  { key: 'avoidHighFailureSlots', label: 'Zeitfenster mit hoher Ausfallrate meiden' },
  { key: 'allowOverbooking', label: 'Überbuchung erlauben' },
  { key: 'preferConsistentTimeslots', label: 'Über die Saison gleiche Zeitfenster bevorzugen' },
] as const;

export function ConfigStep() {
  const { state, dispatch } = useWizard();
  const [config, setConfig] = useState(state.planningConfig);

  // Abrechnung (Stundensatz, Mitgliedsbeitrag, Zahlungsziel) lebt nicht mehr
  // hier: sie hat mit dem Clustering nichts zu tun und steht jetzt bei den
  // Saison-Einstellungen. Schritt 4 verlinkt dorthin, wenn nichts da ist.

  const handleConfigChange = (key: string, value: number | boolean | string[]) => {
    const next = { ...config, [key]: value };
    setConfig(next);
    dispatch({ type: 'SET_PLANNING_CONFIG', config: next });
  };

  const toggleGoal = (goal: string) => {
    const goals = config.optimizationGoals.includes(goal)
      ? config.optimizationGoals.filter((g) => g !== goal)
      : [...config.optimizationGoals, goal];
    handleConfigChange('optimizationGoals', goals);
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

      {/* Planungseinstellungen — sichtbar ist nur, was ein Verein wirklich
          festlegt. Alles andere steuert den Algorithmus und hat in
          `clustering-engine.ts` einen vermessenen Standardwert; es steht
          eingeklappt darunter, statt Schritt 1 mit zwölf Zahlenfeldern zu
          eröffnen. */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            Planungseinstellungen
          </CardTitle>
          <CardDescription>
            Gruppengrößen und Trainingsdauer für diese Saison. Die Feinheiten des Algorithmus stehen
            darunter — die Voreinstellungen passen für die meisten Vereine.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <NumField
              icon={Users}
              label="Gruppengröße Erwachsene, max."
              min={1}
              max={6}
              value={config.groupMaxSize}
              onChange={(v) => handleConfigChange('groupMaxSize', v)}
            />
            <NumField
              icon={Users}
              label="Gruppengröße Erwachsene, min."
              min={1}
              max={6}
              value={config.groupMinSize}
              onChange={(v) => handleConfigChange('groupMinSize', v)}
            />
            <NumField
              icon={Clock}
              label="Trainingsdauer (Minuten)"
              min={30}
              max={180}
              step={15}
              value={config.slotDurationMinutes}
              onChange={(v) => handleConfigChange('slotDurationMinutes', v)}
            />
            <NumField
              icon={Baby}
              label="Gruppengröße Kinder, max."
              min={2}
              max={10}
              value={config.kidsGroupMaxSize}
              onChange={(v) => handleConfigChange('kidsGroupMaxSize', v)}
            />
            <NumField
              icon={Baby}
              label="Gruppengröße Kinder, min."
              min={1}
              max={6}
              value={config.kidsGroupMinSize}
              onChange={(v) => handleConfigChange('kidsGroupMinSize', v)}
            />
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.includeSunday}
              onChange={(e) => handleConfigChange('includeSunday', e.target.checked)}
              className="rounded border-border mt-0.5"
            />
            <span className="text-sm text-foreground">
              Sonntag in die Planung einbeziehen
              <span className="block text-xs text-muted-foreground font-normal mt-0.5">
                Standardmäßig aus — Sonntag ist spielfrei (Vereinsrealität, Arbeits- &amp;
                Ruhezeitregeln für Trainer). Nur aktivieren, wenn bewusst gewünscht.
              </span>
            </span>
          </label>

          <details className="group rounded-xl border border-border bg-muted/20">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-foreground flex items-center gap-2">
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              Feinjustierung des Algorithmus
              <span className="text-xs font-normal text-muted-foreground">
                — nur nötig, wenn das Ergebnis nicht passt
              </span>
            </summary>
            <div className="px-4 pb-4 space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <NumField
                  label="Max. Niveau-Abstand"
                  hint="0 = nur gleiche Spielstärke, 1 = eine Stufe Unterschied erlaubt"
                  min={0}
                  max={3}
                  value={config.maxNiveauLevelSteps}
                  onChange={(v) => handleConfigChange('maxNiveauLevelSteps', v)}
                />
                <NumField
                  icon={Gauge}
                  label="Trainer-Auslastung max. %"
                  min={50}
                  max={100}
                  value={config.trainerUtilizationMaxPct}
                  onChange={(v) => handleConfigChange('trainerUtilizationMaxPct', v)}
                />
                <NumField
                  label="Slot-Ausfallrate max. %"
                  hint="Ab dieser Quote gilt ein Zeitfenster als unzuverlässig"
                  min={10}
                  max={80}
                  value={config.slotFailureThreshold}
                  onChange={(v) => handleConfigChange('slotFailureThreshold', v)}
                />
                <NumField
                  icon={Zap}
                  label="Max. Iterationen"
                  hint="Höhere Werte = bessere Ergebnisse, längere Laufzeit"
                  min={100}
                  max={5000}
                  step={100}
                  value={config.maxIterations}
                  onChange={(v) => handleConfigChange('maxIterations', v)}
                />
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Worauf der Auto-Planer optimiert
                </p>
                <div className="space-y-2">
                  {OPTIMIZATION_GOALS.map((goal) => (
                    <label key={goal.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.optimizationGoals.includes(goal.id)}
                        onChange={() => toggleGoal(goal.id)}
                        className="rounded border-border"
                      />
                      <span className="text-sm text-foreground">{goal.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {BOOLEAN_OPTIONS.map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(config[opt.key])}
                      onChange={(e) => handleConfigChange(opt.key, e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="text-sm text-foreground">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </details>
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

      {/* Zwei Kennzahlen — „Bereitschaft" stand hier ein zweites Mal, die Ampel
          der Bereitschaftsprüfung ganz oben sagt dasselbe. */}
      <div className="grid gap-3 md:grid-cols-2">
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
      </div>
      {/* Member Selector */}
      <MemberSelector />
    </div>
  );
}

'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ScheduleGrid from '@/lib/season-planning/schedule-grid';
import GroupListView from '@/lib/season-planning/group-list-view';
import { useSchedulePlan } from '@/lib/season-planning/use-schedule-plan';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useWizard } from '@/lib/season-planning/wizard-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  Play,
  RefreshCw,
  Users,
  Target,
  Heart,
  Star,
  Zap,
  CheckCircle,
  Save,
  History,
  RotateCcw,
} from 'lucide-react';

import { COLORS } from '@/lib/season-planning/schedule-constants';
import type { ScheduleSlot } from '@/lib/season-planning/types';
import { apiFetch } from '@/lib/api-fetch';
import { formatDateTime } from '@/lib/format';
import { toast } from 'sonner';

interface PlanVersion {
  id: string;
  label: string;
  createdAt: string;
  createdByName: string | null;
  groupCount: number;
}

/**
 * Gespeicherte Planstände.
 *
 * Ein Klick auf „Neu generieren" wirft den gesamten Plan weg und baut ihn neu auf —
 * inklusive aller von Hand verschobenen Gruppen. Wer vorher einen Stand sichert,
 * kommt darauf zurück.
 */
function PlanVersionsPanel({
  seasonId,
  plan,
  onRestore,
}: {
  seasonId: string;
  plan: ScheduleSlot[];
  onRestore: (slots: ScheduleSlot[]) => void;
}) {
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch(`/api/seasons/${seasonId}/planning/versions`);
    if (!res.ok) return;
    const data = await res.json();
    setVersions(data.versions ?? []);
  }, [seasonId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (plan.length === 0) return;
    setBusy('save');
    try {
      const res = await apiFetch(`/api/seasons/${seasonId}/planning/versions`, {
        method: 'POST',
        body: JSON.stringify({ label, slots: plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(extractErrorMessage(data) ?? 'Stand konnte nicht gesichert werden');
        return;
      }
      toast.success(`Planstand „${data.version?.label}" gesichert`);
      setLabel('');
      await load();
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async (version: PlanVersion) => {
    setBusy(version.id);
    try {
      const res = await apiFetch(`/api/seasons/${seasonId}/planning/versions`, {
        method: 'PUT',
        body: JSON.stringify({ versionId: version.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(extractErrorMessage(data) ?? 'Wiederherstellen fehlgeschlagen');
        return;
      }
      onRestore(data.slots ?? []);
      const missing: string[] = data.missingGroupNames ?? [];
      if (missing.length > 0) {
        toast.warning(
          `„${version.label}" übernommen — ${missing.length} Gruppe${missing.length !== 1 ? 'n' : ''} aus diesem Stand gibt es nicht mehr: ${missing.join(', ')}`
        );
      } else {
        toast.success(`„${version.label}" wiederhergestellt`);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          Planstände
        </CardTitle>
        <CardDescription>
          Sichert den aktuellen Wochenstundenplan. „Neu generieren" überschreibt den Plan — ein
          gesicherter Stand lässt sich danach wieder herstellen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Bezeichnung (optional, z.B. „vor Trainerwechsel“)"
            maxLength={100}
            className="flex-1"
          />
          <Button
            onClick={handleSave}
            disabled={busy !== null || plan.length === 0}
            size="sm"
            className="gap-2 shrink-0"
          >
            {busy === 'save' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Stand sichern
          </Button>
        </div>

        {versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch kein Stand gesichert. Es werden die letzten 10 aufbewahrt.
          </p>
        ) : (
          <div className="space-y-2">
            {versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{v.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(new Date(v.createdAt))} · {v.groupCount} Gruppen
                    {v.createdByName ? ` · ${v.createdByName}` : ''}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => void handleRestore(v)}
                  className="gap-1.5 shrink-0"
                >
                  {busy === v.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  Wiederherstellen
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * PlanEditStep (Schritt 3 von 4)
 *
 * Responsibilities:
 * 1. Plan Generation: Run clustering algorithm with config
 * 2. Metrics Display: Show quality score + detailed metrics
 * 3. Conflict Detection (live): Real-time court double-booking check
 * 4. Plan Editing: Drag & drop member reassignment
 * 5. AI Analysis: Optional AI-powered plan review
 * 6. Waitlist Summary: Show members on waitlist with positions
 * 7. Unassigned Members: Show why members couldn't be assigned
 */
export function PlanEditStep() {
  const { state, dispatch, runClustering } = useWizard();
  const {
    plan,
    setPlan,
    expandedSlot,
    setExpandedSlot,
    moveMember,
    slotMove,
    slotUpdate,
    byDay,
    activeDays,
  } = useSchedulePlan();

  const [isGenerating, setIsGenerating] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(!state.clusteringResult);
  const [hydratedFromPersisted, setHydratedFromPersisted] = useState(false);

  // Ein Reload verliert den Wizard-Reducer, nicht den Plan: season_plan_entries
  // trägt jede Handkorrektur bereits (siehe PUT .../planning/plan unten). Vor der
  // „Plan generieren"-Leerseite erst prüfen, ob schon ein gespeicherter Plan da ist.
  useEffect(() => {
    if (state.clusteringResult || !state.seasonId) {
      setIsHydrating(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/seasons/${state.seasonId}/plan-grid`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const rows = (data.slots ?? []) as Array<{
          id: string;
          group_name: string;
          group_color: string;
          trainer_id: string | null;
          trainer_name: string;
          court_id: string | null;
          court_name: string | null;
          day_of_week: number;
          start_time: string;
          end_time: string;
          duration_min: number;
          member_ids: string[];
          member_names: string[];
        }>;
        if (rows.length === 0 || cancelled) return;
        const slots: ScheduleSlot[] = rows.map((r) => ({
          id: r.id,
          groupName: r.group_name,
          groupColor: r.group_color,
          trainerId: r.trainer_id ?? '',
          trainerName: r.trainer_name,
          dayOfWeek: r.day_of_week,
          startTime: r.start_time,
          endTime: r.end_time,
          durationMin: r.duration_min,
          courtId: r.court_id,
          courtName: r.court_name,
          memberIds: r.member_ids,
          memberNames: r.member_names,
        }));
        setPlan(slots);
        dispatch({ type: 'SET_SCHEDULE_SLOTS', slots });
        setHydratedFromPersisted(true);
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.seasonId]);

  // Convert ClusteringResult → ScheduleSlot[] when result changes
  useEffect(() => {
    if (state.clusteringResult) {
      const slots = state.clusteringResult.groups.map((g, i) => ({
        id: g.groupId,
        groupName: g.groupName,
        groupColor: COLORS[i % COLORS.length],
        trainerId: g.trainerId,
        trainerName: g.trainerName,
        dayOfWeek: g.dayOfWeek as number,
        startTime: g.startTime,
        endTime: g.endTime,
        durationMin: (() => {
          const [sh, sm] = g.startTime.split(':').map(Number);
          const [eh, em] = g.endTime.split(':').map(Number);
          return eh * 60 + em - (sh * 60 + sm);
        })(),
        courtId: g.courtId,
        courtName: g.courtName,
        memberIds: g.memberIds,
        memberNames: g.memberDetails.map((d) => d.memberName),
      }));
      setPlan(slots);
      dispatch({ type: 'SET_SCHEDULE_SLOTS', slots });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.clusteringResult]);

  // Verschobene Gruppen landeten bisher nur im React-State — planning/confirm liest
  // die Termine aber aus der DB, jede Handkorrektur war beim Publish weg. Deshalb
  // wird nach jeder Änderung zurückgeschrieben. `dirty` verhindert, dass schon das
  // Befüllen aus dem frischen Clustering-Ergebnis einen Schreibvorgang auslöst.
  const dirtyRef = useRef(false);
  const markDirty = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  useEffect(() => {
    if (!dirtyRef.current || plan.length === 0 || !state.seasonId) return;
    const timer = setTimeout(async () => {
      dirtyRef.current = false;
      const res = await apiFetch(`/api/seasons/${state.seasonId}/planning/plan`, {
        method: 'PUT',
        body: JSON.stringify({ slots: plan }),
      });
      if (!res.ok) toast.error('Änderung am Plan konnte nicht gespeichert werden');
    }, 800);
    return () => clearTimeout(timer);
  }, [plan, state.seasonId]);

  const handleSlotMove = useCallback(
    (slotId: string, newDay: number, newStartTime: string) => {
      slotMove(slotId, newDay, newStartTime);
      markDirty();
    },
    [slotMove, markDirty]
  );

  const handleSlotUpdate = useCallback(
    (updated: ScheduleSlot) => {
      slotUpdate(updated);
      markDirty();
    },
    [slotUpdate, markDirty]
  );

  const handleMoveMember = useCallback(
    (fromId: string, personId: string, personName: string, toId: string) => {
      moveMember(fromId, personId, personName, toId);
      markDirty();
    },
    [moveMember, markDirty]
  );

  // Sync DnD changes (drop, moveMember) back to wizard context
  // plan only changes on drop/moveMember, not during drag-over — no performance concern
  useEffect(() => {
    if (plan.length > 0) {
      dispatch({ type: 'SET_SCHEDULE_SLOTS', slots: plan });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  // Die Wartelisten-Einträge der Datenbank tragen die IDs, die zum Nachrücken
  // gebraucht werden — das Clustering-Ergebnis kennt nur Namen. Deshalb werden sie
  // hier einmal nachgeladen und über die Mitglieds-ID zugeordnet.
  const [waitlistIds, setWaitlistIds] = useState<Record<string, string>>({});
  const [promoting, setPromoting] = useState<string | null>(null);

  const loadWaitlist = useCallback(async () => {
    if (!state.seasonId) return;
    const res = await apiFetch(`/api/seasons/${state.seasonId}/planning/waitlist`);
    if (!res.ok) return;
    const data = await res.json();
    setWaitlistIds(
      Object.fromEntries(
        (data.waitlist ?? []).map((w: { member_id: string; id: string }) => [w.member_id, w.id])
      )
    );
  }, [state.seasonId]);

  useEffect(() => {
    void loadWaitlist();
  }, [loadWaitlist, state.clusteringResult]);

  const handlePromote = useCallback(
    async (memberId: string) => {
      const waitlistId = waitlistIds[memberId];
      if (!waitlistId) return;
      setPromoting(memberId);
      try {
        const res = await apiFetch(`/api/seasons/${state.seasonId}/planning/waitlist`, {
          method: 'POST',
          body: JSON.stringify({ waitlistId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(extractErrorMessage(data) ?? 'Nachrücken fehlgeschlagen');
          return;
        }
        toast.success('Mitglied in die Gruppe aufgenommen');
        await runClustering();
      } finally {
        setPromoting(null);
      }
    },
    [waitlistIds, state.seasonId, runClustering]
  );

  const runGenerate = useCallback(async () => {
    setIsGenerating(true);
    setGenerationError(null);
    try {
      await runClustering();
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'Fehler bei der Generierung');
    } finally {
      setIsGenerating(false);
    }
  }, [runClustering]);

  // Neu generieren verwirft alle bestehenden Planeinträge und legt sie neu an —
  // von Hand geänderte Plätze, Zeiten oder Trainer sind danach weg, ohne dass
  // die Oberfläche das vorher gesagt hätte. Beim ersten Lauf (noch kein Plan)
  // gibt es nichts zu verlieren, da fragt niemand.
  const handleGenerate = useCallback(() => {
    if (state.clusteringResult || plan.length > 0) {
      setConfirmRegenerate(true);
      return;
    }
    void runGenerate();
  }, [state.clusteringResult, plan.length, runGenerate]);

  const metrics = state.clusteringResult?.metrics;

  // ponytail: live court double-booking check — runs on every plan change, no API call needed
  const courtConflicts = useMemo(() => {
    const conflicts: Array<{ courtName: string; day: number; time: string; groups: string[] }> = [];
    const byCourtDayTime = new Map<string, string[]>();
    for (const slot of plan) {
      if (!slot.courtId) continue;
      const key = `${slot.courtId}|${slot.dayOfWeek}|${slot.startTime}`;
      const existing = byCourtDayTime.get(key) ?? [];
      existing.push(slot.groupName);
      byCourtDayTime.set(key, existing);
    }
    for (const [key, groupNames] of byCourtDayTime.entries()) {
      if (groupNames.length < 2) continue;
      const [, dayStr, time] = key.split('|');
      const slot = plan.find((s) => s.dayOfWeek === Number(dayStr) && s.startTime === time);
      conflicts.push({
        courtName: slot?.courtName ?? 'Unbekannter Platz',
        day: Number(dayStr),
        time,
        groups: groupNames,
      });
    }
    return conflicts;
  }, [plan]);

  // Compute auto-plan style score from clustering metrics
  const scoreData = useMemo(() => {
    if (!metrics) return null;
    // Weighted score: Niveau-Match (35%), Wunschpartner (30%), Trainer-Auslastung (20%), Penalty-Free (15%)
    const penaltyCount =
      metrics.niveauSpanViolations + metrics.highRiskSlotsUsed + metrics.trainerOverloadWarnings;
    const penaltyScore = Math.max(0, 100 - penaltyCount * 10);
    const score = Math.round(
      metrics.avgNiveauMatch * 0.35 +
        metrics.wishPartnerRate * 0.3 +
        metrics.avgTrainerUtilization * 0.2 +
        penaltyScore * 0.15
    );
    const totalWarnings = penaltyCount;
    const isExcellent = totalWarnings === 0 && score >= 80;
    return { score, totalWarnings, isExcellent };
  }, [metrics]);

  if (isHydrating) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!state.clusteringResult && !hydratedFromPersisted) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-light/10 mx-auto mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Planung generieren</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Der Algorithmus erstellt basierend auf Mitglieder-Präferenzen, Trainer-Verfügbarkeiten
              und Niveau-Einstufungen einen optimierten Wochenstundenplan.
            </p>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              variant="primary"
              size="lg"
              className="mt-6 gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generiere...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Plan generieren
                </>
              )}
            </Button>
            {generationError && (
              <div className="flex items-center gap-2 mt-4 justify-center text-sm text-error-600">
                <AlertTriangle className="h-4 w-4" />
                {generationError}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Overview */}
      {metrics && scoreData && (
        <div className="space-y-4">
          {/* Score Card */}
          <Card className={scoreData.isExcellent ? 'border-success-500/50 bg-success-50/50' : ''}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-warning-500" />
                  Planungs-Score
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-xs bg-info-50 text-info-700 border-info-200"
                  >
                    Quelle: Auto
                  </Badge>
                  <Badge
                    variant={
                      scoreData.score >= 80
                        ? 'success'
                        : scoreData.score >= 60
                          ? 'warning'
                          : 'error'
                    }
                  >
                    {scoreData.score >= 80
                      ? 'Sehr gut'
                      : scoreData.score >= 60
                        ? 'Gut'
                        : 'Verbesserungswürdig'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span
                  className={`text-3xl font-bold ${scoreData.score >= 80 ? 'text-success-600' : scoreData.score >= 60 ? 'text-warning-600' : 'text-error-600'}`}
                >
                  {scoreData.score}%
                </span>
                <span className="text-xs text-muted-foreground">
                  {metrics.iterations} Iterationen in {metrics.runtimeMs}ms
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    scoreData.score >= 80
                      ? 'bg-success-500'
                      : scoreData.score >= 60
                        ? 'bg-warning-500'
                        : 'bg-error-500'
                  }`}
                  style={{ width: `${Math.min(100, scoreData.score)}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Detail Metric Cards */}
          <div className="grid gap-3 md:grid-cols-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <p className="text-xs text-muted-foreground">Gruppen</p>
                </div>
                <p className="text-xl font-bold mt-1">{metrics.totalGroups}</p>
                <p className="text-2xs text-muted-foreground">{metrics.totalMembers} Mitglieder</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-success-500" />
                  <p className="text-xs text-muted-foreground">Niveau-Match</p>
                </div>
                <p className="text-xl font-bold mt-1">{Math.round(metrics.avgNiveauMatch)}%</p>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-success-500"
                    style={{ width: `${Math.round(metrics.avgNiveauMatch)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-error-400" />
                  <p className="text-xs text-muted-foreground">Wunschpartner</p>
                </div>
                <p className="text-xl font-bold mt-1">{Math.round(metrics.wishPartnerRate)}%</p>
                <p className="text-2xs text-muted-foreground">
                  {metrics.wishPartnerFulfilled}/{metrics.wishPartnerRequests} erfüllt
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-warning-500" />
                  <p className="text-xs text-muted-foreground">Trainer-Auslastung</p>
                </div>
                <p className="text-xl font-bold mt-1">
                  {Math.round(metrics.avgTrainerUtilization)}%
                </p>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-warning-500"
                    style={{ width: `${Math.round(metrics.avgTrainerUtilization)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Warnings Section */}
          {(scoreData.totalWarnings > 0 || courtConflicts.length > 0) && (
            <Card className="border-warning-500/50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning-600" />
                  <CardTitle className="text-base text-warning-800">
                    {scoreData.totalWarnings + courtConflicts.length} Warnung
                    {scoreData.totalWarnings + courtConflicts.length !== 1 ? 'en' : ''}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {metrics.niveauSpanViolations > 0 && (
                    <li className="text-sm text-warning-700">
                      • {metrics.niveauSpanViolations} Niveau-Spannen-Verletzung
                      {metrics.niveauSpanViolations !== 1 ? 'en' : ''}
                    </li>
                  )}
                  {metrics.highRiskSlotsUsed > 0 && (
                    <li className="text-sm text-warning-700">
                      • {metrics.highRiskSlotsUsed} Hochrisiko-Slot
                      {metrics.highRiskSlotsUsed !== 1 ? 's' : ''} verwendet
                    </li>
                  )}
                  {metrics.trainerOverloadWarnings > 0 && (
                    <li className="text-sm text-warning-700">
                      • {metrics.trainerOverloadWarnings} Trainer-Überlastung
                      {metrics.trainerOverloadWarnings !== 1 ? 'en' : ''}
                    </li>
                  )}
                  {courtConflicts.map((c, i) => (
                    <li key={i} className="text-sm text-error-700">
                      • Platzdoppelbelegung: {c.courtName} {c.time} Uhr — {c.groups.join(' & ')}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Excellent Plan Card */}
          {scoreData.isExcellent && (
            <Card className="border-success-500/50 bg-success-50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-success-600" />
                  <CardTitle className="text-base text-success-900">Exzellente Planung!</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-success-800">
                  Der Algorithmus hat eine optimale Planung ohne Warnungen erstellt. Sie können
                  diesen Plan übernehmen oder weitere Anpassungen vornehmen.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Regenerate Button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Neu generieren
        </Button>
        {generationError && (
          <span className="text-sm text-error-600 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            {generationError}
          </span>
        )}
      </div>

      {/* Schedule Grid with dnd-kit */}
      <ScheduleGrid plan={plan} onSlotMove={handleSlotMove} onSlotUpdate={handleSlotUpdate} />

      {/* Gespeicherte Planstände */}
      <PlanVersionsPanel seasonId={state.seasonId} plan={plan} onRestore={setPlan} />

      {/* Group List View */}
      <GroupListView
        plan={plan}
        expandedSlot={expandedSlot}
        byDay={byDay()}
        activeDays={activeDays()}
        onToggleExpand={(id) => setExpandedSlot(id)}
        onMoveMember={handleMoveMember}
      />

      {/* Waitlist Summary */}
      {state.clusteringResult && state.clusteringResult.waitlistSummary.length > 0 && (
        <Card className="border-info-200 bg-info-50/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-info-700">
              <Users className="h-4 w-4" />
              Warteliste ({state.clusteringResult.waitlistSummary.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {state.clusteringResult.waitlistSummary.map((w, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl border border-info-100 bg-background p-3 text-sm"
                >
                  <span className="font-medium">{w.memberName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {w.groupName} (Pos. {w.position})
                    </span>
                    {w.alternativeGroupName && (
                      <Badge variant="outline" className="text-xs">
                        Alternativ: {w.alternativeGroupName}
                      </Badge>
                    )}
                    {waitlistIds[w.memberId] && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={promoting === w.memberId}
                        onClick={() => void handlePromote(w.memberId)}
                      >
                        {promoting === w.memberId ? 'Wird aufgenommen…' : 'In Gruppe aufnehmen'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unassigned Members */}
      {state.clusteringResult && state.clusteringResult.unassignedMembers.length > 0 && (
        <Card className="border-error-200 bg-error-50/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-error-700">
              <AlertTriangle className="h-4 w-4" />
              Nicht zugewiesen ({state.clusteringResult.unassignedMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {state.clusteringResult.unassignedMembers.map((m) => (
                <div
                  key={m.memberId}
                  className="flex items-center justify-between rounded-xl border border-error-100 bg-background p-3 text-sm"
                >
                  <span className="font-medium">{m.memberName}</span>
                  <span className="text-error-600 text-xs">{m.reason}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Runtime Info */}
      <p className="text-xs text-muted-foreground text-right">
        Generierung in {metrics?.runtimeMs ?? 0}ms abgeschlossen
      </p>

      <ConfirmDialog
        open={confirmRegenerate}
        onOpenChange={setConfirmRegenerate}
        variant="warning"
        title="Plan neu generieren?"
        description={`Der Algorithmus verwirft den bestehenden Plan und legt ihn komplett neu an. Alle von Hand geänderten Plätze, Zeiten, Trainer und Gruppenzuordnungen gehen dabei verloren.`}
        confirmLabel="Neu generieren"
        cancelLabel="Plan behalten"
        loading={isGenerating}
        onConfirm={runGenerate}
      />
    </div>
  );
}

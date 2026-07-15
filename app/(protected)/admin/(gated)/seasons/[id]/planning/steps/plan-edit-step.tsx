'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import ScheduleGrid from '@/lib/season-planning/schedule-grid';
import GroupListView from '@/lib/season-planning/group-list-view';
import { useSchedulePlan } from '@/lib/season-planning/use-schedule-plan';
import { generateAIAnalysis } from '@/lib/season-planning/ai-analysis';
import { PremiumUpsellTrigger } from '@/components/season-planning/premium-upsell-trigger';
import { useWizard } from '@/lib/season-planning/wizard-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  Play,
  RefreshCw,
  Brain,
  Users,
  Target,
  Heart,
  Star,
  Zap,
  CheckCircle,
} from 'lucide-react';

import { COLORS } from '@/lib/season-planning/schedule-constants';

/**
 * PlanEditStep (Schritt 2 von 3)
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
  const [aiText, setAiText] = useState<string | null>(state.aiAnalysisText);
  const [aiLoading, setAiLoading] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

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

  // Sync DnD changes (drop, moveMember) back to wizard context
  // plan only changes on drop/moveMember, not during drag-over — no performance concern
  useEffect(() => {
    if (plan.length > 0) {
      dispatch({ type: 'SET_SCHEDULE_SLOTS', slots: plan });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const handleGenerate = useCallback(async () => {
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

  const handleAiAnalysis = useCallback(async () => {
    if (plan.length === 0) return;
    setAiLoading(true);
    try {
      const members = plan.flatMap((s) => s.memberIds);
      const uniqueMembers = new Set(members);
      const totalInPlan = uniqueMembers.size;
      const totalAllMembers = state.selectedMemberIds.length;
      const multiple = members.length - uniqueMembers.size;

      const text = await generateAIAnalysis({
        plan,
        totalMembers: totalAllMembers,
        totalMembersPlanned: totalInPlan,
        membersMultipleGroups: multiple,
        membersNotPlanned:
          totalAllMembers > totalInPlan
            ? state.selectedMemberIds
                .filter((id) => !uniqueMembers.has(id))
                .map((_id, i) => ({ name: `Mitglied ${i + 1}` }))
            : [],
        seasonStart: '',
        seasonEnd: '',
        activeWeeks: 1,
        useAI: true,
      });
      setAiText(text);
    } catch {
      setAiText('KI-Analyse momentan nicht verfügbar.');
    } finally {
      setAiLoading(false);
    }
  }, [plan, state.selectedMemberIds]);

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

  if (!state.clusteringResult) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-light/10 mx-auto mb-4">
              <Sparkles className="h-8 w-8 text-brand-primary" />
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
                  <Users className="h-4 w-4 text-brand-primary" />
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
      <ScheduleGrid plan={plan} onSlotMove={slotMove} onSlotUpdate={slotUpdate} />

      {/* Group List View */}
      <GroupListView
        plan={plan}
        expandedSlot={expandedSlot}
        byDay={byDay()}
        activeDays={activeDays()}
        onToggleExpand={(id) => setExpandedSlot(id)}
        onMoveMember={moveMember}
      />

      {/* AI Analysis */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-brand-primary" />
            KI-Analyse
          </CardTitle>
          <CardDescription>Automatische Bewertung des generierten Plans</CardDescription>
        </CardHeader>
        <CardContent>
          {aiText ? (
            <div className="rounded-xl bg-brand-light/5 border border-brand-light/20 p-4">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {aiText}
              </p>
            </div>
          ) : (
            <div className="text-center py-6">
              <Button
                onClick={handleAiAnalysis}
                disabled={aiLoading}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analysiere...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4" />
                    Plan analysieren
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Waitlist Summary */}
      {state.clusteringResult.waitlistSummary.length > 0 && (
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
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unassigned Members */}
      {state.clusteringResult.unassignedMembers.length > 0 && (
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

      {/* 1.2.2 Premium Upsell — fires once after first lock-step, Starter-tier only.
          Self-contained: returns null until conditions are met. */}
      <PremiumUpsellTrigger seasonId={state.seasonId} maxReachedStep={state.maxReachedStep} />
    </div>
  );
}

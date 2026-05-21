'use client';

import { useState, useEffect, useCallback } from 'react';
import ScheduleGrid from '@/lib/season-planning/schedule-grid';
import GroupListView from '@/lib/season-planning/group-list-view';
import { useSchedulePlan } from '@/lib/season-planning/use-schedule-plan';
import { generateAIAnalysis } from '@/lib/season-planning/ai-analysis';
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
} from 'lucide-react';

import { COLORS } from '@/lib/season-planning/schedule-constants';

export function PlanEditStep() {
  const { state, dispatch, runClustering } = useWizard();
  const {
    plan,
    setPlan,
    dragging,
    setDragging,
    dragOver,
    setDragOver,
    expandedSlot,
    setExpandedSlot,
    moveMember,
    drop,
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
          return (eh * 60 + em) - (sh * 60 + sm);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, state.selectedMemberIds]);

  const metrics = state.clusteringResult?.metrics;

  if (!state.clusteringResult) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-light/10 mx-auto mb-4">
              <Sparkles className="h-8 w-8 text-brand-primary" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Planung generieren
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Der Algorithmus erstellt basierend auf Mitglieder-Präferenzen,
              Trainer-Verfügbarkeiten und Niveau-Einstufungen einen optimierten
              Wochenstundenplan.
            </p>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              variant="brand"
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
              <div className="flex items-center gap-2 mt-4 justify-center text-sm text-red-600">
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
      {metrics && (
        <div className="grid gap-3 md:grid-cols-5">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-brand-primary" />
                <p className="text-xs text-muted-foreground">Gruppen</p>
              </div>
              <p className="text-xl font-bold mt-1">{metrics.totalGroups}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-green-500" />
                <p className="text-xs text-muted-foreground">Niveau-Match</p>
              </div>
              <p className="text-xl font-bold mt-1">{Math.round(metrics.avgNiveauMatch)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-400" />
                <p className="text-xs text-muted-foreground">Wunschpartner</p>
              </div>
              <p className="text-xl font-bold mt-1">{Math.round(metrics.wishPartnerRate)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                <p className="text-xs text-muted-foreground">Trainer-Auslastung</p>
              </div>
              <p className="text-xl font-bold mt-1">{Math.round(metrics.avgTrainerUtilization)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <p className="text-xs text-muted-foreground">Hinweise</p>
              </div>
              <p className="text-xl font-bold mt-1">
                {metrics.niveauSpanViolations + metrics.highRiskSlotsUsed + metrics.trainerOverloadWarnings}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Regenerate Button */}
      <div className="flex items-center gap-3">
        <Button onClick={handleGenerate} disabled={isGenerating} variant="outline" size="sm" className="gap-2">
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Neu generieren
        </Button>
        {generationError && (
          <span className="text-sm text-red-600 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            {generationError}
          </span>
        )}
      </div>

      {/* Schedule Grid */}
      <ScheduleGrid
        plan={plan}
        dragging={dragging}
        dragOver={dragOver}
        onDragStart={(slot) => setDragging(slot)}
        onDragEnd={() => {
          setDragging(null);
          setDragOver(null);
        }}
        onDragOver={(key) => setDragOver(key)}
        onDrop={drop}
      />

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
          <CardDescription>
            Automatische Bewertung des generierten Plans
          </CardDescription>
        </CardHeader>
        <CardContent>
          {aiText ? (
            <div className="rounded-lg bg-brand-light/5 border border-brand-light/20 p-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
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
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-blue-700">
              <Users className="h-4 w-4" />
              Warteliste ({state.clusteringResult.waitlistSummary.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {state.clusteringResult.waitlistSummary.map((w, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-blue-100 bg-white p-3 text-sm"
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
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              Nicht zugewiesen ({state.clusteringResult.unassignedMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {state.clusteringResult.unassignedMembers.map((m) => (
                <div
                  key={m.memberId}
                  className="flex items-center justify-between rounded-lg border border-red-100 bg-white p-3 text-sm"
                >
                  <span className="font-medium">{m.memberName}</span>
                  <span className="text-red-600 text-xs">{m.reason}</span>
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
    </div>
  );
}

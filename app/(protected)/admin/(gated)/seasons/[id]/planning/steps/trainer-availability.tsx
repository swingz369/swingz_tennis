'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useWizard } from '@/lib/season-planning/wizard-context';
import { Users, AlertTriangle, CheckCircle2, Clock, Send, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';

interface TrainerEntry {
  trainerId: string;
  trainerName: string;
  maxHoursPerWeek: number;
  maxUtilizationPct: number;
  effectiveMaxHours: number;
  currentAssignedHours: number;
  availableSlots: number;
  utilizationStatus: 'under' | 'optimal' | 'near_limit' | 'over';
  hasSubmittedPreferences: boolean;
}

export function TrainerAvailabilityPanel() {
  const { state, dispatch } = useWizard();
  const [loading, setLoading] = useState(true);
  const [reminding, setReminding] = useState(false);
  const [trainers, setTrainers] = useState<TrainerEntry[]>([]);
  const [overallUtilization, setOverallUtilization] = useState(0);
  const [burnoutWarnings, setBurnoutWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchTrainers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await apiFetch(`/api/seasons/${state.seasonId}/planning/trainers`);
      if (!res.ok) throw new Error('Trainerdaten konnten nicht geladen werden');

      const data = await res.json();
      const summary = data.summary;

      setTrainers(summary.trainers ?? []);
      setOverallUtilization(summary.overallUtilization ?? 0);
      setBurnoutWarnings(summary.burnoutWarnings ?? []);

      dispatch({
        type: 'SET_TRAINER_AVAILABILITY',
        summary: {
          trainers: (summary.trainers ?? []).map((t: TrainerEntry) => ({
            trainerId: t.trainerId,
            trainerName: t.trainerName,
            maxHoursPerWeek: t.maxHoursPerWeek,
            maxUtilizationPct: t.maxUtilizationPct,
            effectiveMaxHours: t.effectiveMaxHours,
            currentAssignedHours: t.currentAssignedHours,
            availableSlots: t.availableSlots,
            utilizationStatus: t.utilizationStatus,
          })),
          overallUtilization: summary.overallUtilization,
          burnoutWarnings: summary.burnoutWarnings,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [state.seasonId, dispatch]);

  useEffect(() => {
    fetchTrainers();
  }, [fetchTrainers]);

  const handleRemind = useCallback(async () => {
    setReminding(true);
    try {
      const res = await apiFetch(`/api/seasons/${state.seasonId}/planning/remind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'trainer' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? 'Erinnerung fehlgeschlagen');
      } else {
        const data = await res.json();
        toast.success(`${data.sent ?? 0} Trainer erinnert`);
      }
    } catch {
      toast.error('Netzwerkfehler');
    } finally {
      setReminding(false);
    }
  }, [state.seasonId]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Trainer-Verfügbarkeiten
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-error-200 bg-error-50 dark:bg-error-900/10">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-error-600 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Fehler: {error}</span>
            </div>
            <Button size="sm" variant="outline" onClick={fetchTrainers}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Neu laden
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (trainers.length === 0) {
    return (
      <Card className="border-warning-200 bg-warning-50 dark:bg-warning-900/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-warning-700 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Keine Trainer gefunden. Füge Trainer unter{' '}
              <a href="/admin/trainers" className="underline font-medium">
                Admin → Trainer
              </a>{' '}
              hinzu.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const submittedCount = trainers.filter((t) => t.hasSubmittedPreferences).length;
  const pendingCount = trainers.length - submittedCount;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Trainer-Verfügbarkeiten ({trainers.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={fetchTrainers}
              disabled={loading}
              className="h-7 px-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {pendingCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRemind}
                disabled={reminding}
                className="h-7 text-xs gap-1"
              >
                <Send className="h-3 w-3" />
                {reminding ? 'Sende...' : `${pendingCount} erinnern`}
              </Button>
            )}
          </div>
        </div>
        {pendingCount > 0 && (
          <p className="text-xs text-warning-600 dark:text-warning-400 mt-1">
            {pendingCount} Trainer {pendingCount === 1 ? 'hat' : 'haben'} noch keine
            Planungspräferenzen eingereicht — Trainer können diese unter{' '}
            <a href="/trainer/planning-preferences" className="underline font-medium">
              Trainer → Planungspräferenzen
            </a>{' '}
            eintragen. Der Algorithmus nutzt bis dahin Standardverfügbarkeit.
          </p>
        )}
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          {trainers.map((trainer) => {
            const pct =
              trainer.effectiveMaxHours > 0
                ? Math.round((trainer.currentAssignedHours / trainer.effectiveMaxHours) * 100)
                : 0;

            return (
              <div
                key={trainer.trainerId}
                className={`flex items-center justify-between p-3 rounded-xl border text-sm ${
                  !trainer.hasSubmittedPreferences
                    ? 'bg-warning-50 border-warning-200 dark:bg-warning-900/10 dark:border-warning-800'
                    : trainer.utilizationStatus === 'over'
                      ? 'bg-error-50 border-error-200 dark:bg-error-900/10 dark:border-error-800'
                      : trainer.utilizationStatus === 'near_limit'
                        ? 'bg-warning-50 border-warning-200 dark:bg-warning-900/10 dark:border-warning-800'
                        : 'bg-success-50 border-success-200 dark:bg-success-900/10 dark:border-success-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0">
                    {!trainer.hasSubmittedPreferences ? (
                      <Clock className="h-4 w-4 text-warning-500" />
                    ) : trainer.utilizationStatus === 'over' ? (
                      <AlertTriangle className="h-4 w-4 text-error-500" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-success-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{trainer.trainerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {trainer.hasSubmittedPreferences
                        ? `${trainer.availableSlots} Slots verfügbar · ${trainer.currentAssignedHours.toFixed(1)}h / ${trainer.effectiveMaxHours.toFixed(1)}h · ${pct}%`
                        : 'Präferenzen ausstehend — Standardverfügbarkeit wird verwendet'}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={
                    !trainer.hasSubmittedPreferences
                      ? 'warning'
                      : trainer.utilizationStatus === 'over'
                        ? 'error'
                        : trainer.utilizationStatus === 'near_limit'
                          ? 'warning'
                          : 'success'
                  }
                  size="sm"
                  className="shrink-0"
                >
                  {!trainer.hasSubmittedPreferences
                    ? 'Ausstehend'
                    : trainer.utilizationStatus === 'over'
                      ? 'Überlastet'
                      : trainer.utilizationStatus === 'near_limit'
                        ? 'Fast voll'
                        : trainer.utilizationStatus === 'optimal'
                          ? 'Optimal'
                          : 'Verfügbar'}
                </Badge>
              </div>
            );
          })}
        </div>

        {burnoutWarnings.length > 0 && (
          <div className="mt-3 p-3 rounded-xl bg-error-50 border border-error-200 dark:bg-error-900/10 dark:border-error-800">
            <p className="text-xs font-medium text-error-700 dark:text-error-400 mb-1">
              Burnout-Risiko
            </p>
            {burnoutWarnings.map((w, i) => (
              <p key={i} className="text-xs text-error-600 dark:text-error-300">
                {w}
              </p>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-border dark:border-border">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Trainer gesamt</p>
            <p className="text-lg font-bold text-primary">{trainers.length}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Eingereicht</p>
            <p
              className={`text-lg font-bold ${submittedCount === trainers.length ? 'text-success-600' : 'text-warning-600'}`}
            >
              {submittedCount}/{trainers.length}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Ø Auslastung</p>
            <p className="text-lg font-bold text-primary">{Math.round(overallUtilization)}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

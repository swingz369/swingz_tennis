'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useWizard } from '@/lib/season-planning/wizard-context';
import {
  UserCheck,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Gauge,
} from 'lucide-react';
import type { TrainerAvailabilitySummary } from '@/lib/season-planning/types';

export function TrainerAvailability() {
  const { state, dispatch } = useWizard();
  const [summary, setSummary] = useState<TrainerAvailabilitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/seasons/${state.seasonId}/planning/trainers`
      );
      if (!res.ok) throw new Error('Fehler beim Laden der Trainer-Daten');
      const data = await res.json();
      setSummary(data.summary);
      dispatch({ type: 'SET_TRAINER_AVAILABILITY', summary: data.summary });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, [state.seasonId, dispatch]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const statusConfig: Record<
    string,
    { label: string; color: string; icon: typeof CheckCircle }
  > = {
    under: {
      label: 'Gering ausgelastet',
      color: 'bg-blue-100 text-blue-700 border-blue-200',
      icon: Clock,
    },
    optimal: {
      label: 'Optimal ausgelastet',
      color: 'bg-green-100 text-green-700 border-green-200',
      icon: CheckCircle,
    },
    near_limit: {
      label: 'Nahe am Limit',
      color: 'bg-amber-100 text-amber-700 border-amber-200',
      icon: AlertTriangle,
    },
    over: {
      label: 'Überlastet',
      color: 'bg-red-100 text-red-700 border-red-200',
      icon: AlertTriangle,
    },
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="py-8 text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
          <p className="mt-2 text-sm text-red-600">{error || 'Keine Daten'}</p>
        </CardContent>
      </Card>
    );
  }

  const overallUtilization = Math.round(summary.overallUtilization);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-brand-primary" />
              Trainer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.trainers.length}</p>
            <p className="text-xs text-muted-foreground">Verfügbar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Gauge className="h-4 w-4 text-blue-500" />
              Gesamtauslastung
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                overallUtilization > 80
                  ? 'text-red-600'
                  : overallUtilization > 60
                  ? 'text-amber-600'
                  : 'text-green-600'
              }`}
            >
              {overallUtilization}%
            </p>
            <div className="mt-2 h-2 w-full rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  overallUtilization > 80
                    ? 'bg-red-500'
                    : overallUtilization > 60
                    ? 'bg-amber-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, overallUtilization)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              Burnout-Warnungen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${summary.burnoutWarnings.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {summary.burnoutWarnings.length}
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.burnoutWarnings.length > 0 ? 'Zu prüfen' : 'Keine'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Burnout Warnings */}
      {summary.burnoutWarnings.length > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Burnout-Risiko Warnungen
            </CardTitle>
            <CardDescription>
              Diese Trainer sind potenziell überlastet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {summary.burnoutWarnings.map((warning, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  {warning}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Trainer List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-brand-primary" />
            Trainer-Auslastung
          </CardTitle>
          <CardDescription>
            Maximale Auslastung = {summary.trainers[0]?.maxUtilizationPct || 80}% des
            Wochenstunden-Limits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {summary.trainers.map((trainer) => {
              const status = statusConfig[trainer.utilizationStatus] || statusConfig.optimal;
              const StatusIcon = status.icon;
              const utilizationPct = Math.round(
                (trainer.currentAssignedHours / Math.max(1, trainer.effectiveMaxHours)) * 100
              );

              return (
                <div
                  key={trainer.trainerId}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {trainer.trainerName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {trainer.currentAssignedHours}h von max {trainer.effectiveMaxHours}h
                      </p>
                    </div>
                    <Badge className={status.color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {status.label}
                    </Badge>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Auslastung</span>
                      <span
                        className={`font-medium ${
                          utilizationPct > 80
                            ? 'text-red-600'
                            : utilizationPct > 60
                            ? 'text-amber-600'
                            : 'text-green-600'
                        }`}
                      >
                        {utilizationPct}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${
                          utilizationPct > 80
                            ? 'bg-red-500'
                            : utilizationPct > 60
                            ? 'bg-amber-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, utilizationPct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

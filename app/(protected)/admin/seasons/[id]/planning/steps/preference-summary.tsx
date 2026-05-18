'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useWizard } from '@/lib/season-planning/wizard-context';
import {
  FileCheck,
  AlertTriangle,
  Clock,
  Heart,
  XCircle,
  CheckCircle,
  BarChart3,
} from 'lucide-react';
import type { PreferencesSummary as PreferencesSummaryType } from '@/lib/season-planning/types';

export function PreferenceSummary() {
  const { state, dispatch } = useWizard();
  const [summary, setSummary] = useState<PreferencesSummaryType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/seasons/${state.seasonId}/planning/preferences-summary`
      );
      if (!res.ok) throw new Error('Fehler beim Laden der Präferenzen');
      const data = await res.json();
      setSummary(data.summary);
      dispatch({ type: 'SET_PREFERENCES_SUMMARY', summary: data.summary });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, [state.seasonId, dispatch]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const DAY_NAMES = [
    'Montag',
    'Dienstag',
    'Mittwoch',
    'Donnerstag',
    'Freitag',
    'Samstag',
    'Sonntag',
  ];

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
        <Skeleton className="h-48" />
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

  const responseRate = Math.round(summary.responseRate);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-brand-primary" />
              Rücklaufquote
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{responseRate}%</p>
            <p className="text-xs text-muted-foreground">
              {summary.submittedCount} von {summary.totalMembers} Mitgliedern
            </p>
            <div className="mt-2 h-2 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand-primary transition-all"
                style={{ width: `${responseRate}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Risiko-Slots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">
              {summary.slotFailureWarnings.length}
            </p>
            <p className="text-xs text-muted-foreground">
              Zeitslots mit hoher Ausfallrate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-400" />
              Wunschpartner-Konflikte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {summary.incompatibleWishPartners.length}
            </p>
            <p className="text-xs text-muted-foreground">
              Niveau-Inkompatible Paare
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Slot Failure Rate Warnings */}
      {summary.slotFailureWarnings.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Zeitslots mit hoher historischer Ausfallrate
            </CardTitle>
            <CardDescription>
              Diese Zeitslots werden beim Clustering deprioritisiert
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summary.slotFailureWarnings.map((slot, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/50 p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {DAY_NAMES[slot.dayOfWeek] || `Tag ${slot.dayOfWeek}`},{' '}
                      {slot.startTime} Uhr
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {slot.warning}
                    </p>
                  </div>
                  <Badge
                    className={
                      slot.failureRate >= 50
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }
                  >
                    {Math.round(slot.failureRate * 100)}% Ausfallrate
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {summary.slotFailureWarnings.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
            <p className="mt-2 text-sm font-medium text-green-700">
              Keine kritischen Zeitslots
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Alle Zeitslots haben akzeptable Ausfallraten
            </p>
          </CardContent>
        </Card>
      )}

      {/* Incompatible Wish Partner Pairs */}
      {summary.incompatibleWishPartners.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Nicht erfüllbare Wunschpartner-Paarungen
            </CardTitle>
            <CardDescription>
              Diese Paarungen können aufgrund von Niveau-Unterschieden nicht
              zusammen in einer Gruppe sein
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summary.incompatibleWishPartners.map((pair, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50/50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium">
                        {pair.memberA.name}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {pair.memberA.level}
                      </Badge>
                    </div>
                    <Heart className="h-3 w-3 text-red-300" />
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium">
                        {pair.memberB.name}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {pair.memberB.level}
                      </Badge>
                    </div>
                  </div>
                  <span className="text-xs text-red-600">{pair.reason}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {summary.incompatibleWishPartners.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
            <p className="mt-2 text-sm font-medium text-green-700">
              Alle Wunschpaarungen kompatibel
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Keine Niveau-Konflikte zwischen Wunschpartnern
            </p>
          </CardContent>
        </Card>
      )}

      {/* Overall Metrics Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-brand-primary" />
            Präferenz-Statistik
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Eingereichte Präferenzen
              </p>
              <p className="text-2xl font-bold">{summary.submittedCount}</p>
              <p className="text-xs text-muted-foreground">
                von {summary.totalMembers} Mitgliedern
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Fehlende Präferenzen
              </p>
              <p className="text-2xl font-bold">
                {summary.totalMembers - summary.submittedCount}
              </p>
              <p className="text-xs text-muted-foreground">
                Noch nicht eingereicht
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Wunschpartner gesamt
              </p>
              <p className="text-2xl font-bold">
                {summary.incompatibleWishPartners.length}
              </p>
              <p className="text-xs text-muted-foreground">
                Davon nicht erfüllbar
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

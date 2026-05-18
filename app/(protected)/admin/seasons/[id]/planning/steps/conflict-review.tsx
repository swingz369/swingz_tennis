'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWizard } from '@/lib/season-planning/wizard-context';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  ShieldAlert,
  InfoIcon,
  Sparkles,
} from 'lucide-react';
import type { ConflictDetectionResult, ConflictSeverityLevel } from '@/lib/season-planning/types';

export function ConflictReview() {
  const { state } = useWizard();
  const [conflicts, setConflicts] = useState<ConflictDetectionResult[]>(state.conflicts);
  const [_loading, _setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    if (state.conflicts.length > 0) {
      setConflicts(state.conflicts);
    }
  }, [state.conflicts]);

  const handleResolve = async (conflictId: string) => {
    setResolvingId(conflictId);
    try {
      const res = await fetch(
        `/api/seasons/${state.seasonId}/planning/conflicts`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conflictId, action: 'resolve', notes: 'Manuell gelöst' }),
        }
      );
      if (!res.ok) throw new Error('Fehler beim Lösen des Konflikts');

      setConflicts((prev) =>
        prev.map((c) =>
          c.id === conflictId ? { ...c, status: 'resolved' as const } : c
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setResolvingId(null);
    }
  };

  const handleIgnore = async (conflictId: string) => {
    setResolvingId(conflictId);
    try {
      const res = await fetch(
        `/api/seasons/${state.seasonId}/planning/conflicts`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conflictId, action: 'ignore', notes: 'Bewusst ignoriert' }),
        }
      );
      if (!res.ok) throw new Error('Fehler beim Ignorieren des Konflikts');

      setConflicts((prev) =>
        prev.map((c) =>
          c.id === conflictId ? { ...c, status: 'ignored' as const } : c
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setResolvingId(null);
    }
  };

  const criticalConflicts = conflicts.filter((c) => c.severity === 'critical');
  const warningConflicts = conflicts.filter((c) => c.severity === 'warning');
  const infoConflicts = conflicts.filter((c) => c.severity === 'info');
  const resolvedCount = conflicts.filter((c) => c.status === 'resolved').length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <p className="text-xs text-muted-foreground">Kritisch</p>
            </div>
            <p className={`text-xl font-bold mt-1 ${criticalConflicts.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {criticalConflicts.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <p className="text-xs text-muted-foreground">Warnungen</p>
            </div>
            <p className="text-xl font-bold mt-1">{warningConflicts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-muted-foreground">Hinweise</p>
            </div>
            <p className="text-xl font-bold mt-1">{infoConflicts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <p className="text-xs text-muted-foreground">Gelöst</p>
            </div>
            <p className="text-xl font-bold mt-1">
              {resolvedCount}/{conflicts.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Critical Conflicts Block */}
      {criticalConflicts.length > 0 && !criticalConflicts.every((c) => c.status !== 'open') && (
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <ShieldAlert className="h-5 w-5" />
              Kritische Konflikte — müssen vor Bestätigung gelöst werden
            </CardTitle>
            <CardDescription className="text-red-600">
              Diese Konflikte blockieren die finale Bestätigung in Schritt 6
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {criticalConflicts.map((conflict) => (
              <ConflictCard
                key={conflict.id}
                conflict={conflict}
                onResolve={handleResolve}
                onIgnore={handleIgnore}
                isResolving={resolvingId === conflict.id}
                canIgnore={false} // Critical conflicts cannot be ignored
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {warningConflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              Warnungen — können bewusst übergangen werden
            </CardTitle>
            <CardDescription>
              Diese Warnungen müssen vor der Bestätigung akzeptiert werden
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {warningConflicts.map((conflict) => (
              <ConflictCard
                key={conflict.id}
                conflict={conflict}
                onResolve={handleResolve}
                onIgnore={handleIgnore}
                isResolving={resolvingId === conflict.id}
                canIgnore={true}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Info / Hinweise */}
      {infoConflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-blue-700">
              <InfoIcon className="h-5 w-5" />
              Hinweise
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {infoConflicts.map((conflict) => (
              <ConflictCard
                key={conflict.id}
                conflict={conflict}
                onResolve={handleResolve}
                onIgnore={handleIgnore}
                isResolving={resolvingId === conflict.id}
                canIgnore={true}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {conflicts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
              Keine Konflikte gefunden
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Die Planung ist konfliktfrei und kann bestätigt werden
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================
// CONFLICT CARD (single conflict)
// ============================================

function ConflictCard({
  conflict,
  onResolve,
  onIgnore,
  isResolving,
  canIgnore,
}: {
  conflict: ConflictDetectionResult;
  onResolve: (id: string) => void;
  onIgnore: (id: string) => void;
  isResolving: boolean;
  canIgnore: boolean;
}) {
  const severityConfig: Record<ConflictSeverityLevel, { badgeColor: string }> = {
    critical: { badgeColor: 'bg-red-100 text-red-700' },
    warning: { badgeColor: 'bg-amber-100 text-amber-700' },
    info: { badgeColor: 'bg-blue-100 text-blue-700' },
  };
  const config = severityConfig[conflict.severity];

  const isOpen = conflict.status === 'open';

  return (
    <div
      className={`rounded-lg border p-4 ${
        conflict.status === 'resolved'
          ? 'border-green-200 bg-green-50/30 opacity-70'
          : conflict.status === 'ignored'
          ? 'border-gray-200 bg-gray-50/30 opacity-70'
          : conflict.severity === 'critical'
          ? 'border-red-200 bg-white'
          : 'border-amber-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={`text-xs ${config.badgeColor}`}>
              {conflict.severity === 'critical'
                ? 'Kritisch'
                : conflict.severity === 'warning'
                ? 'Warnung'
                : 'Hinweis'}
            </Badge>
            {conflict.status === 'resolved' && (
              <Badge className="text-xs bg-green-100 text-green-700">
                <CheckCircle className="h-3 w-3 mr-0.5" />
                Gelöst
              </Badge>
            )}
            {conflict.status === 'ignored' && (
              <Badge className="text-xs bg-gray-100 text-gray-600">
                <XCircle className="h-3 w-3 mr-0.5" />
                Ignoriert
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {conflict.description}
          </p>
          {conflict.suggestedResolution && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-brand-primary" />
              {conflict.suggestedResolution}
            </p>
          )}
          {conflict.timeSlot && (
            <p className="text-xs text-muted-foreground mt-1">
              Zeit: {conflict.timeSlot.dayOfWeek}, {conflict.timeSlot.startTime}-
              {conflict.timeSlot.endTime}
            </p>
          )}
        </div>

        {isOpen && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onResolve(conflict.id)}
              disabled={isResolving}
              className="text-xs h-8"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Lösen
            </Button>
            {canIgnore && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onIgnore(conflict.id)}
                disabled={isResolving}
                className="text-xs h-8"
              >
                <XCircle className="h-3 w-3 mr-1" />
                Ignorieren
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

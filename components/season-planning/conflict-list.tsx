'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CheckCircle,
  XCircle,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  Calendar,
  Wrench,
} from 'lucide-react';
import type { ConflictDetectionResult } from '@/lib/season-planning/types';
import { DAY_LABELS } from '@/lib/season-planning/schedule-constants';
import { conflictFixTarget } from '@/lib/season-planning/conflict-utils';

/**
 * Die Konfliktliste der Saisonplanung — eine Darstellung für beide Orte, an
 * denen Konflikte auftauchen: die eigene Seite `/admin/seasons/[id]/conflicts`
 * und Schritt 4 des Planungs-Wizards.
 *
 * Vorher waren das zwei getrennte Implementierungen mit abweichendem Verhalten:
 * die eigene Seite ließ auch kritische Konflikte "ignorieren" (der Plan wäre
 * dann ohne Platz oder Trainer veröffentlicht worden), zeigte den falschen
 * Wochentag und zählte anders. Kritische Konflikte lassen sich hier nur
 * beheben, nicht ignorieren.
 *
 * `onFix` führt an die Stelle, an der die Ursache liegt (Wizard-Schritt aus
 * `conflictFixTarget`). Es ersetzt den früheren Knopf "Lösen", der nur einen
 * Status setzte, ohne an den Daten etwas zu ändern.
 */
export function ConflictList({
  conflicts,
  onFix,
  onIgnore,
  resolvingId,
}: {
  conflicts: ConflictDetectionResult[];
  onFix: (conflict: ConflictDetectionResult) => void;
  onIgnore: (id: string) => void;
  resolvingId: string | null;
}) {
  const open = conflicts.filter((c) => c.status === 'open');
  const critical = open.filter((c) => c.severity === 'critical');
  const warnings = open.filter((c) => c.severity !== 'critical');
  const decided = conflicts.filter((c) => c.status !== 'open');

  return (
    <div className="space-y-6">
      {critical.length > 0 && (
        <Card className="border-error-200 bg-error-50/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-error-700">
              <ShieldAlert className="h-5 w-5" />
              Kritische Konflikte — müssen behoben werden
            </CardTitle>
            <CardDescription className="text-error-600">
              Diese Konflikte blockieren das Veröffentlichen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {critical.map((conflict) => (
              <ConflictCard
                key={conflict.id}
                conflict={conflict}
                onFix={onFix}
                onIgnore={onIgnore}
                isResolving={resolvingId === conflict.id}
                canIgnore={false}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {warnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-warning-700">
              <AlertTriangle className="h-5 w-5" />
              Warnungen & Hinweise
            </CardTitle>
            <CardDescription>
              Blockieren nicht. Beheben Sie sie oder nehmen Sie sie mit &quot;Ignorieren&quot;
              bewusst in Kauf — beides wird protokolliert.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {warnings.map((conflict) => (
              <ConflictCard
                key={conflict.id}
                conflict={conflict}
                onFix={onFix}
                onIgnore={onIgnore}
                isResolving={resolvingId === conflict.id}
                canIgnore={true}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {open.length === 0 && (
        <Card className="border-success-200 bg-success-50/30">
          <CardContent className="py-8 text-center">
            <CheckCircle className="h-12 w-12 text-success-500 mx-auto" />
            <h3 className="mt-4 text-lg font-semibold text-success-800">
              {conflicts.length === 0
                ? 'Keine Konflikte gefunden'
                : 'Alle Konflikte gelöst oder ignoriert'}
            </h3>
            <p className="text-sm text-success-700 mt-1">Die Planung kann veröffentlicht werden.</p>
          </CardContent>
        </Card>
      )}

      {decided.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">
              Erledigt ({decided.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {decided.map((conflict) => (
              <ConflictCard
                key={conflict.id}
                conflict={conflict}
                onFix={onFix}
                onIgnore={onIgnore}
                isResolving={resolvingId === conflict.id}
                canIgnore={false}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const SEVERITY_LABEL = {
  critical: { text: 'Kritisch', badge: 'bg-error-100 text-error-700' },
  warning: { text: 'Warnung', badge: 'bg-warning-100 text-warning-700' },
  info: { text: 'Hinweis', badge: 'bg-info-100 text-info-700' },
} as const;

function ConflictCard({
  conflict,
  onFix,
  onIgnore,
  isResolving,
  canIgnore,
}: {
  conflict: ConflictDetectionResult;
  onFix: (conflict: ConflictDetectionResult) => void;
  onIgnore: (id: string) => void;
  isResolving: boolean;
  canIgnore: boolean;
}) {
  const severity = SEVERITY_LABEL[conflict.severity];
  const isOpen = conflict.status === 'open';
  const fixTarget = conflictFixTarget(conflict.type);

  return (
    <div
      className={`rounded-xl border p-4 ${
        conflict.status === 'resolved'
          ? 'border-success-200 bg-success-50/30 opacity-70'
          : conflict.status === 'ignored'
            ? 'border-border bg-muted/30 opacity-70'
            : conflict.severity === 'critical'
              ? 'border-error-200 bg-background'
              : 'border-warning-200 bg-background'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={`text-xs ${severity.badge}`}>{severity.text}</Badge>
            {conflict.status === 'resolved' && (
              <Badge className="text-xs bg-success-100 text-success-700">
                <CheckCircle className="h-3 w-3 mr-0.5" /> Gelöst
              </Badge>
            )}
            {conflict.status === 'ignored' && (
              <Badge className="text-xs bg-muted text-muted-foreground">
                <XCircle className="h-3 w-3 mr-0.5" /> Ignoriert
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium text-foreground">{conflict.description}</p>
          {conflict.timeSlot && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Calendar className="h-3 w-3 shrink-0" />
              {/* DAY_LABELS ist 0-basiert (0 = Montag), wie dayOfWeek der App. */}
              {DAY_LABELS[conflict.timeSlot.dayOfWeek] ??
                `Tag ${conflict.timeSlot.dayOfWeek}`}, {conflict.timeSlot.startTime}–
              {conflict.timeSlot.endTime}
            </p>
          )}
          {conflict.suggestedResolution && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-primary shrink-0" />
              {conflict.suggestedResolution}
            </p>
          )}
          {isOpen && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Wrench className="h-3 w-3 shrink-0" />
              {fixTarget.hint}
            </p>
          )}
        </div>

        {isOpen && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onFix(conflict)}
              disabled={isResolving}
              className="text-xs h-8"
            >
              <Wrench className="h-3 w-3 mr-1" /> Beheben
            </Button>
            {canIgnore && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onIgnore(conflict.id)}
                disabled={isResolving}
                className="text-xs h-8"
              >
                <XCircle className="h-3 w-3 mr-1" /> Ignorieren
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

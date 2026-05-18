'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useWizard } from '@/lib/season-planning/wizard-context';
import {
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Info,
  Loader2,
  ClipboardCheck,
  Users,
  Calendar,
  Clock,
  Bell,
  FileText,
  Sparkles,
} from 'lucide-react';

export function ConfirmationStep() {
  const { state, confirmPlan } = useWizard();
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmedWarnings, setConfirmedWarnings] = useState<Set<string>>(new Set());
  const [adminNotes, setAdminNotes] = useState('');

  const criticalConflicts = state.conflicts.filter((c) => c.severity === 'critical' && c.status === 'open');
  const warningConflicts = state.conflicts.filter((c) => c.severity === 'warning' || c.severity === 'info');
  const hasBlockingConflicts = criticalConflicts.length > 0;
  const allWarningsAccepted =
    warningConflicts.length === 0 ||
    warningConflicts.every((c) => confirmedWarnings.has(c.id));

  const handleConfirm = useCallback(async () => {
    if (hasBlockingConflicts) return;
    if (!allWarningsAccepted) return;

    setIsConfirming(true);
    try {
      await confirmPlan();
    } catch {
      // Error handled in context
    } finally {
      setIsConfirming(false);
    }
  }, [hasBlockingConflicts, allWarningsAccepted, confirmPlan]);

  const toggleWarning = (conflictId: string) => {
    setConfirmedWarnings((prev) => {
      const next = new Set(prev);
      if (next.has(conflictId)) {
        next.delete(conflictId);
      } else {
        next.add(conflictId);
      }
      return next;
    });
  };

  if (state.isConfirmed) {
    return (
      <div className="space-y-6">
        <Card className="border-green-200 bg-green-50/30">
          <CardContent className="py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-green-800 dark:text-green-400">
              Planung erfolgreich bestätigt!
            </h2>
            <p className="text-sm text-green-700 dark:text-green-300 mt-2 max-w-md mx-auto">
              Trainingsgruppen und Sessions wurden erstellt. Mitglieder und
              Trainer werden automatisch benachrichtigt.
            </p>
          </CardContent>
        </Card>

        {/* Post-Confirmation Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-brand-primary" />
                <p className="text-sm text-muted-foreground">Gruppen</p>
              </div>
              <p className="text-2xl font-bold mt-1">
                {state.clusteringResult?.groups.length || 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-green-500" />
                <p className="text-sm text-muted-foreground">Sessions</p>
              </div>
              <p className="text-2xl font-bold mt-1">
                {state.publishedSessionIds.length}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-500" />
                <p className="text-sm text-muted-foreground">Benachrichtigungen</p>
              </div>
              <p className="text-2xl font-bold mt-1">
                {state.selectedMemberIds.length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Waitlist Notifications */}
        {(state.clusteringResult?.waitlistSummary.length || 0) > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                Wartelisten-Benachrichtigungen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {state.clusteringResult?.waitlistSummary.map((w, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 text-sm text-muted-foreground"
                  >
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium">{w.memberName}</span>
                    <span>
                      Warteliste {w.groupName} (Pos. {w.position})
                    </span>
                    {w.alternativeGroupName && (
                      <Badge variant="outline" className="text-xs">
                        Alternativ: {w.alternativeGroupName}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pre-Confirmation Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-primary" />
              <p className="text-sm text-muted-foreground">Gruppen</p>
            </div>
            <p className="text-2xl font-bold mt-1">
              {state.clusteringResult?.groups.length || 0}
            </p>
            <p className="text-xs text-muted-foreground">
              {state.clusteringResult?.metrics.totalMembers || 0} Mitglieder
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <p className="text-sm text-muted-foreground">Offene Punkte</p>
            </div>
            <p className="text-2xl font-bold mt-1">
              {state.conflicts.filter((c) => c.status === 'open').length}
            </p>
            <p className="text-xs text-muted-foreground">
              {criticalConflicts.length} kritisch, {warningConflicts.length} Warnungen/Hinweise
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-green-500" />
              <p className="text-sm text-muted-foreground">Niveau-Match</p>
            </div>
            <p className="text-2xl font-bold mt-1">
              {Math.round(state.clusteringResult?.metrics.avgNiveauMatch || 0)}%
            </p>
            <p className="text-xs text-muted-foreground">Durchschnitt</p>
          </CardContent>
        </Card>
      </div>

      {/* Blocking Conflicts */}
      {hasBlockingConflicts && (
        <Card className="border-red-300 bg-red-50/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <ShieldAlert className="h-5 w-5" />
              Bestätigung blockiert
            </CardTitle>
            <CardDescription className="text-red-600">
              {criticalConflicts.length} kritische Konflikte müssen in Schritt 5
              gelöst werden, bevor die Planung bestätigt werden kann.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {criticalConflicts.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start gap-2 text-sm text-red-700"
                >
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  {c.description}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Warning Acceptance */}
      {warningConflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Warnungen und Hinweise bestätigen
            </CardTitle>
            <CardDescription>
              Akzeptieren Sie jede Warnung bewusst. Diese Entscheidung wird im
              Protokoll festgehalten.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {warningConflicts.map((conflict) => (
                <label
                  key={conflict.id}
                  className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                >
                  <Checkbox
                    checked={confirmedWarnings.has(conflict.id)}
                    onCheckedChange={() => toggleWarning(conflict.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge
                        className={`text-xs ${
                          conflict.severity === 'warning'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {conflict.severity === 'warning' ? 'Warnung' : 'Hinweis'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {conflict.description}
                    </p>
                    {conflict.suggestedResolution && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-brand-primary" />
                        {conflict.suggestedResolution}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand-primary" />
            Admin-Notiz (optional)
          </CardTitle>
          <CardDescription>
            Diese Notiz wird im Planungsprotokoll gespeichert
          </CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            className="w-full min-h-[80px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm resize-y"
            placeholder="z.B. &quot;Planung mit Vorstand abgestimmt am...&quot;"
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Confirm Button */}
      <div className="flex items-center justify-between border-t pt-6">
        <div className="text-sm text-muted-foreground">
          {hasBlockingConflicts ? (
            <span className="flex items-center gap-1 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              Kritische Konflikte müssen zuerst gelöst werden
            </span>
          ) : !allWarningsAccepted ? (
            <span className="flex items-center gap-1 text-amber-600">
              <Info className="h-4 w-4" />
              Bitte alle Warnungen bestätigen
            </span>
          ) : (
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle className="h-4 w-4" />
              Bereit zur Bestätigung
            </span>
          )}
        </div>

        <Button
          onClick={handleConfirm}
          disabled={hasBlockingConflicts || !allWarningsAccepted || isConfirming}
          variant="brand"
          size="lg"
          className="gap-2"
        >
          {isConfirming ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Bestätige...
            </>
          ) : (
            <>
              <ClipboardCheck className="h-4 w-4" />
              Planung bestätigen & veröffentlichen
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

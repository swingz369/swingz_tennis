'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Clock,
  EyeOff,
  UserX,
  Users,
  Building2,
  MapPin,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import type { ConflictDetectionResult, ConflictTypeCode } from '@/lib/season-planning/types';
import { DAY_LABELS } from '@/lib/season-planning/schedule-constants';

interface ConflictSummary {
  critical: number;
  warnings: number;
  info: number;
  total: number;
}

interface ConflictsData {
  success: boolean;
  conflicts: ConflictDetectionResult[];
  summary: ConflictSummary;
}

const CONFLICT_TYPE_LABELS: Record<ConflictTypeCode, string> = {
  trainer_double_booking: 'Trainer-Doppelbuchung',
  member_double_booking: 'Mitglieder-Doppelbuchung',
  no_trainer_assigned: 'Kein Trainer zugewiesen',
  court_unavailable: 'Platz nicht verfügbar',
  trainer_over_limit: 'Trainer-Überlastung',
  high_failure_rate_slot: 'Hohe Ausfallrate (Slot)',
  large_niveau_span: 'Große Niveau-Spanne',
  avoid_partner_conflict: 'Partner-Konflikt',
};

const SEVERITY_CONFIG: Record<string, { icon: typeof AlertTriangle; color: string; bg: string; label: string }> = {
  critical: { icon: AlertTriangle, color: 'text-error-600 dark:text-error-400', bg: 'bg-error-50 dark:bg-error-950 border-error-200 dark:border-error-800', label: 'Kritisch' },
  warning: { icon: AlertCircle, color: 'text-warning-600 dark:text-warning-400', bg: 'bg-warning-50 dark:bg-warning-950 border-warning-200 dark:border-warning-800', label: 'Warnung' },
  info: { icon: Info, color: 'text-info-600 dark:text-info-400', bg: 'bg-info-50 dark:bg-info-950 border-info-200 dark:border-info-800', label: 'Info' },
};

const ConflictIcon = ({ type }: { type: ConflictTypeCode }) => {
  switch (type) {
    case 'trainer_double_booking':
    case 'trainer_over_limit':
      return <UserX className="h-4 w-4" />;
    case 'member_double_booking':
    case 'avoid_partner_conflict':
      return <Users className="h-4 w-4" />;
    case 'court_unavailable':
      return <Building2 className="h-4 w-4" />;
    case 'no_trainer_assigned':
      return <MapPin className="h-4 w-4" />;
    case 'high_failure_rate_slot':
      return <AlertTriangle className="h-4 w-4" />;
    case 'large_niveau_span':
      return <Info className="h-4 w-4" />;
    default:
      return <AlertCircle className="h-4 w-4" />;
  }
};

interface ConflictsPageProps {
  params: Promise<{ id: string }>;
}

export default function ConflictsPage({ params }: ConflictsPageProps) {
  const { id: seasonId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<ConflictsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchConflicts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/seasons/${seasonId}/planning/conflicts`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Fehler beim Laden der Konflikte');
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    fetchConflicts();
  }, [fetchConflicts]);

  const handleAction = async (conflictId: string, action: 'resolve' | 'ignore') => {
    setActionLoading(conflictId);
    try {
      const res = await apiFetch(`/api/seasons/${seasonId}/planning/conflicts`, {
        method: 'PATCH',
        body: JSON.stringify({ conflictId, action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Fehler beim Aktualisieren');
        return;
      }
      toast.success(action === 'resolve' ? 'Konflikt gelöst' : 'Konflikt ignoriert');

      // Update local state optimistically
      setData((prev) => {
        if (!prev) return prev;
        const newStatus = (action === 'resolve' ? 'resolved' : 'ignored') as ConflictDetectionResult['status'];
        const updated: ConflictDetectionResult[] = prev.conflicts.map((c) =>
          c.id === conflictId ? { ...c, status: newStatus } : c
        );
        const openAfter = updated.filter((c) => c.status === 'open');
        return {
          ...prev,
          conflicts: updated,
          summary: {
            critical: openAfter.filter((c) => c.severity === 'critical').length,
            warnings: openAfter.filter((c) => c.severity === 'warning').length,
            info: openAfter.filter((c) => c.severity === 'info').length,
            total: prev.summary.total,
          },
        };
      });
    } catch {
      toast.error('Netzwerkfehler');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/seasons/${seasonId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück zur Saison
        </Button>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle>Fehler</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={fetchConflicts} className="mt-4" variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { conflicts, summary } = data!;

  const openConflicts = conflicts.filter((c) => c.status === 'open');
  const resolvedConflicts = conflicts.filter((c) => c.status === 'resolved');
  const ignoredConflicts = conflicts.filter((c) => c.status === 'ignored');

  const groupedBySeverity = {
    critical: openConflicts.filter((c) => c.severity === 'critical'),
    warning: openConflicts.filter((c) => c.severity === 'warning'),
    info: openConflicts.filter((c) => c.severity === 'info'),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/admin/seasons/${seasonId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planungskonflikte</h1>
          <p className="text-sm text-muted-foreground">
            {summary.total} Konflikt{summary.total !== 1 ? 'e' : ''} erkannt —{' '}
            {openConflicts.length} offen, {resolvedConflicts.length} gelöst, {ignoredConflicts.length} ignoriert
          </p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={fetchConflicts}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Neu laden
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {(
          [
            { key: 'critical', data: SEVERITY_CONFIG.critical, count: summary.critical },
            { key: 'warning', data: SEVERITY_CONFIG.warning, count: summary.warnings },
            { key: 'info', data: SEVERITY_CONFIG.info, count: summary.info },
          ] as const
        ).map(({ key, data: sev, count }) => {
          const Icon = sev.icon;
          return (
            <Card key={key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{sev.label}</CardTitle>
                <Icon className={`h-4 w-4 ${sev.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count}</div>
                <p className="text-xs text-muted-foreground">
                  {count === 0 ? 'Keine' : `${count} ${key === 'info' ? '' : 'offene'} ${key === 'info' ? 'Hinweise' : 'Konflikte'}`}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* No Conflicts */}
      {openConflicts.length === 0 && resolvedConflicts.length === 0 && ignoredConflicts.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle className="h-12 w-12 text-success-500" />
            <p className="mt-4 text-lg font-medium">Keine Konflikte erkannt</p>
            <p className="text-sm text-muted-foreground mt-1">
              Die Planung ist konfliktfrei. Klicke &quot;Neu laden&quot; um eine erneute Prüfung durchzuführen.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Open Conflicts */}
      {openConflicts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Offene Konflikte ({openConflicts.length})</h2>
          {(['critical', 'warning', 'info'] as const).map((severity) => {
            const items = groupedBySeverity[severity];
            if (items.length === 0) return null;
            const sev = SEVERITY_CONFIG[severity];
            const SevIcon = sev.icon;

            return (
              <div key={severity} className="space-y-3">
                {severity !== 'info' && (
                  <div className="flex items-center gap-2">
                    <SevIcon className={`h-4 w-4 ${sev.color}`} />
                    <span className={`text-sm font-medium ${sev.color}`}>
                      {sev.label} ({items.length})
                    </span>
                  </div>
                )}
                {items.map((conflict) => (
                  <Card key={conflict.id} className={`border ${sev.bg}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 rounded-full p-1.5 ${sev.bg}`}>
                            <ConflictIcon type={conflict.type} />
                          </div>
                          <div>
                            <CardTitle className="text-base">
                              {CONFLICT_TYPE_LABELS[conflict.type] || conflict.type}
                            </CardTitle>
                            <CardDescription className="mt-1">{conflict.description}</CardDescription>
                          </div>
                        </div>
                        <Badge variant="outline" className={sev.color}>
                          {sev.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Time Slot */}
                      {conflict.timeSlot && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4 shrink-0" />
                          <span>
                            {DAY_LABELS[conflict.timeSlot.dayOfWeek - 1] || `Tag ${conflict.timeSlot.dayOfWeek}`}
                            , {conflict.timeSlot.startTime}–{conflict.timeSlot.endTime}
                          </span>
                        </div>
                      )}

                      {/* Affected Entities */}
                      {conflict.affectedEntities && (
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {conflict.affectedEntities.trainerIds.length > 0 && (
                            <Badge variant="secondary" className="gap-1">
                              <UserX className="h-3 w-3" />
                              {conflict.affectedEntities.trainerIds.length} Trainer
                            </Badge>
                          )}
                          {conflict.affectedEntities.memberIds.length > 0 && (
                            <Badge variant="secondary" className="gap-1">
                              <Users className="h-3 w-3" />
                              {conflict.affectedEntities.memberIds.length} Mitglieder
                            </Badge>
                          )}
                          {conflict.affectedEntities.courtIds.length > 0 && (
                            <Badge variant="secondary" className="gap-1">
                              <Building2 className="h-3 w-3" />
                              {conflict.affectedEntities.courtIds.length} Plätze
                            </Badge>
                          )}
                          {conflict.affectedEntities.groupIds.length > 0 && (
                            <Badge variant="secondary">
                              {conflict.affectedEntities.groupIds.length} Gruppen
                            </Badge>
                          )}
                          {conflict.affectedEntities.planEntryIds.length > 0 && (
                            <Badge variant="secondary">
                              {conflict.affectedEntities.planEntryIds.length} Einträge
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Suggested Resolution */}
                      {conflict.suggestedResolution && (
                        <div className="rounded-md border border-info-200 bg-info-50 px-3 py-2 text-sm text-info-800 dark:border-info-800 dark:bg-info-950 dark:text-info-200">
                          <span className="font-medium">Vorschlag: </span>
                          {conflict.suggestedResolution}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction(conflict.id, 'resolve')}
                          disabled={actionLoading === conflict.id}
                        >
                          {actionLoading === conflict.id ? (
                            <Clock className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Als gelöst markieren
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction(conflict.id, 'ignore')}
                          disabled={actionLoading === conflict.id}
                        >
                          <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                          Ignorieren
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Resolved/Ignored Conflicts */}
      {(resolvedConflicts.length > 0 || ignoredConflicts.length > 0) && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-muted-foreground">
            Erledigte Konflikte ({resolvedConflicts.length + ignoredConflicts.length})
          </h2>
          {[...resolvedConflicts, ...ignoredConflicts].map((conflict) => (
            <Card key={conflict.id} className="border border-muted opacity-70">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full p-1.5 bg-muted">
                      {conflict.status === 'resolved' ? (
                        <CheckCircle className="h-4 w-4 text-success-500" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base text-muted-foreground">
                        {CONFLICT_TYPE_LABELS[conflict.type] || conflict.type}
                      </CardTitle>
                      <CardDescription className="mt-1">{conflict.description}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className={conflict.status === 'resolved' ? 'text-success-600' : 'text-muted-foreground'}>
                    {conflict.status === 'resolved' ? 'Gelöst' : 'Ignoriert'}
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

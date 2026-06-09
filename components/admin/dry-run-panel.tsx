'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Beaker,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  AlertCircle,
  Info,
  CheckCircle2,
  Calendar,
  Receipt,
  Mail,
  Users,
  Euro,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  MapPin,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { cn } from '@/lib/utils';
import { PieChart, type PieChartDatum } from '@/components/admin/pie-chart';

interface DryRunConflict {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  status: string;
  description: string;
  suggestedResolution?: string | null;
}

interface DryRunBillingGroup {
  groupName: string;
  trainerName: string;
  trainerHourlyRate: number;
  sessionDurationHours: number;
  totalSessions: number;
  participantCount: number;
  totalTrainerCost: number;
  costPerParticipant: number;
}

interface DryRunBilling {
  memberCount: number;
  groupCount: number;
  totalTrainingCost: number;
  totalMembershipFees: number;
  totalAdditionalFees: number;
  grandTotal: number;
  groupBreakdown: DryRunBillingGroup[];
}

interface DryRunSession {
  date: string;
  dayOfWeek: number;
  hour: number;
  durationMin: number;
  groupId: string | null;
  trainerId: string;
  courtId: string | null;
  wouldCreate: boolean;
  skipReason: 'outside_season' | 'holiday' | null;
  holidayNames: string[];
}

interface DryRunReport {
  ok: true;
  generatedAt: string;
  season: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    bundesland: string | null;
  };
  summary: {
    criticalConflictCount: number;
    warningConflictCount: number;
    infoConflictCount: number;
    wouldCreateSessions: number;
    skippedHolidaySessions: number;
    invoicedMemberCount: number;
    activeTrainerCount: number;
    activeCourtCount: number;
    emailRecipientCount: number;
    estimatedEmailCost: number;
    totalSeasonWeeks: number;
    totalActiveWeeks: number;
    totalTrainerHours: number;
    expectedAcceptanceRate: number;
    rsvpSampleSize: number;
  };
  conflicts: DryRunConflict[];
  billing: DryRunBilling | null;
  sessions: {
    total: number;
    sample: DryRunSession[];
  };
  rsvpDistribution: {
    counts: Record<'accepted' | 'declined' | 'maybe' | 'pending' | 'unknown', number>;
    total: number;
    acceptanceRate: number;
    sessionSampleSize: number;
    capturedAt: string;
  } | null;
  warnings: Array<{ level: 'info' | 'warning'; code: string; message: string }>;
}

interface DryRunError {
  ok: false;
  error: string;
  code: string;
}

type DryRunResponse = DryRunReport | DryRunError;

interface Props {
  seasonId: string;
  /** Optional: called when dry-run reports zero blocking conflicts. */
  onReadyToPublish?: () => void;
}

const SEVERITY_STYLES: Record<
  DryRunConflict['severity'],
  { icon: typeof ShieldAlert; color: string; label: string; border: string; bg: string }
> = {
  critical: {
    icon: ShieldAlert,
    color: 'text-red-700',
    label: 'Kritisch',
    border: 'border-red-300',
    bg: 'bg-red-50/50',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-700',
    label: 'Warnung',
    border: 'border-amber-300',
    bg: 'bg-amber-50/40',
  },
  info: {
    icon: Info,
    color: 'text-blue-700',
    label: 'Hinweis',
    border: 'border-blue-300',
    bg: 'bg-blue-50/40',
  },
};

export function DryRunPanel({ seasonId, onReadyToPublish }: Props) {
  const [report, setReport] = useState<DryRunReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAllConflicts, setShowAllConflicts] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);

  const runDryRun = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/seasons/${seasonId}/planning/dry-run`, {
        method: 'POST',
      });
      const data = (await res.json()) as DryRunResponse;
      if (!data.ok) {
        setError(data.error);
        setReport(null);
        return;
      }
      setReport(data);
      if (data.summary.criticalConflictCount === 0) {
        onReadyToPublish?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [seasonId, onReadyToPublish]);

  // Auto-run on mount so the panel is populated when the user opens the step
  useEffect(() => {
    if (!report && !error) {
      void runDryRun();
    }
  }, [report, error, runDryRun]);

  // ── Loading state ────────────────────────────────────────────
  if (loading && !report) {
    return (
      <Card className="border-purple-200 bg-purple-50/30">
        <CardContent className="py-10 flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-purple-600" />
          <p className="text-sm text-purple-700">
            Simuliere Veröffentlichung — Konflikte, Finanzen, E-Mails werden vorberechnet…
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Error state ──────────────────────────────────────────────
  if (error && !report) {
    return (
      <Card className="border-red-200 bg-red-50/30">
        <CardContent className="py-8 space-y-3 text-center">
          <AlertCircle className="h-8 w-8 text-red-600 mx-auto" />
          <p className="text-sm text-red-700">{error}</p>
          <Button onClick={runDryRun} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Erneut versuchen
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!report) return null;

  const { summary, conflicts, billing, sessions, warnings } = report;
  const hasBlockers = summary.criticalConflictCount > 0;

  // ── Render full report ───────────────────────────────────────
  return (
    <Card className="border-purple-200">
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <Beaker className="h-5 w-5" />
              Dry-Run Vorschau
            </CardTitle>
            <CardDescription>
              Simuliert die Veröffentlichung ohne etwas zu schreiben.{' '}
              <span className="text-xs text-muted-foreground">
                Generiert {new Date(report.generatedAt).toLocaleString('de-DE')}
              </span>
            </CardDescription>
          </div>
          <Button
            onClick={runDryRun}
            variant="outline"
            size="sm"
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Neu simulieren
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ═══ Verdict Banner ═══ */}
        {hasBlockers ? (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">
                Veröffentlichung blockiert — {summary.criticalConflictCount} kritische Konflikt
                {summary.criticalConflictCount !== 1 ? 'e' : ''} erkannt
              </p>
              <p className="text-xs text-red-700 mt-0.5">
                Löse die kritischen Konflikte oder akzeptiere sie unten, bevor du fortfährst.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800">
                Bereit zur Veröffentlichung — keine kritischen Konflikte
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                {summary.wouldCreateSessions} Sessions, {summary.invoicedMemberCount} Rechnungen und{' '}
                {summary.emailRecipientCount} E-Mails würden gesendet.
              </p>
            </div>
          </div>
        )}

        {/* ═══ Top-line KPIs ═══ */}
        <div className="grid gap-3 md:grid-cols-4">
          <KpiCard
            icon={<Calendar className="h-4 w-4 text-green-600" />}
            label="Sessions (erstellt)"
            value={summary.wouldCreateSessions.toString()}
            subtitle={
              summary.skippedHolidaySessions > 0
                ? `${summary.skippedHolidaySessions} Ferien übersprungen`
                : 'Keine Ferien-Konflikte'
            }
          />
          <KpiCard
            icon={<Receipt className="h-4 w-4 text-brand-primary" />}
            label="Rechnungen"
            value={summary.invoicedMemberCount.toString()}
            subtitle={
              billing ? `${billing.grandTotal.toFixed(2)} € Volumen` : 'Preview nicht verfügbar'
            }
            highlight
          />
          <KpiCard
            icon={<Mail className="h-4 w-4 text-amber-600" />}
            label="E-Mails"
            value={summary.emailRecipientCount.toString()}
            subtitle={`~${summary.estimatedEmailCost.toFixed(2)} € Versandkosten`}
          />
          <KpiCard
            icon={<Users className="h-4 w-4 text-blue-600" />}
            label="Trainer / Plätze"
            value={`${summary.activeTrainerCount} / ${summary.activeCourtCount}`}
            subtitle={`${summary.totalActiveWeeks} aktive KW × Gruppen`}
          />
        </div>

        {/* ═══ Conflict Summary ═══ */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
              Konflikt-Übersicht
            </h4>
            {conflicts.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllConflicts((v) => !v)}
                className="h-7 text-xs gap-1"
              >
                {showAllConflicts ? 'Weniger' : `Alle ${conflicts.length} anzeigen`}
                {showAllConflicts ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
          <div className="grid gap-2 md:grid-cols-3 text-xs">
            <SeverityPill
              severity="critical"
              count={summary.criticalConflictCount}
              label="Kritisch"
            />
            <SeverityPill
              severity="warning"
              count={summary.warningConflictCount}
              label="Warnungen"
            />
            <SeverityPill severity="info" count={summary.infoConflictCount} label="Hinweise" />
          </div>
          {showAllConflicts && conflicts.length > 0 && (
            <div className="mt-3 space-y-2 max-h-[300px] overflow-y-auto">
              {conflicts.map((c) => {
                const style = SEVERITY_STYLES[c.severity];
                const Icon = style.icon;
                return (
                  <div
                    key={c.id}
                    className={cn('rounded-md border p-2.5 text-xs', style.border, style.bg)}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className={cn('h-3.5 w-3.5 flex-shrink-0 mt-0.5', style.color)} />
                      <div className="flex-1">
                        <Badge className={cn('text-[10px] mb-1', style.color)} variant="outline">
                          {style.label}
                        </Badge>
                        <p className="text-foreground">{c.description}</p>
                        {c.suggestedResolution && (
                          <p className="text-muted-foreground mt-0.5">💡 {c.suggestedResolution}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══ Financial Breakdown ═══ */}
        {billing && billing.groupBreakdown.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <Euro className="h-4 w-4 text-muted-foreground" />
              Finanzieller Impact
            </h4>
            <div className="grid gap-2 md:grid-cols-4 text-sm">
              <FinancialKpi label="Trainingskosten" value={billing.totalTrainingCost} />
              <FinancialKpi label="Mitgliedsbeiträge" value={billing.totalMembershipFees} />
              <FinancialKpi label="Zusatzgebühren" value={billing.totalAdditionalFees} />
              <FinancialKpi label="Gesamtvolumen" value={billing.grandTotal} highlight />
            </div>
          </div>
        )}

        {/* ═══ Resource Utilization ═══ */}
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Ressourcen-Auslastung
          </h4>
          <div className="grid gap-2 md:grid-cols-3 text-xs">
            <ResourceRow
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Trainer-Stunden"
              value={`${summary.totalTrainerHours} h`}
            />
            <ResourceRow
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Aktive KW × Gruppen"
              value={`${summary.totalActiveWeeks}`}
            />
            <ResourceRow
              icon={<MapPin className="h-3.5 w-3.5" />}
              label="Plätze im Einsatz"
              value={`${summary.activeCourtCount}`}
            />
          </div>
        </div>

        {/* ═══ RSVP-Verteilung (Pie Chart) ═══ */}
        {report.rsvpDistribution && report.rsvpDistribution.total > 0 ? (
          <RsvpPieSection distribution={report.rsvpDistribution} />
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center">
            <Mail className="h-5 w-5 text-muted-foreground mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">
              Noch keine RSVP-Daten für diese Saison — Verteilung wird beim ersten Publish
              aufgebaut.
            </p>
          </div>
        )}

        {/* ═══ Session Forecast Sample ═══ */}
        {sessions.sample.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Session-Vorschau (max. {SESSION_SAMPLE_CAP} von {sessions.total})
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllSessions((v) => !v)}
                className="h-7 text-xs gap-1"
              >
                {showAllSessions ? 'Weniger' : 'Alle anzeigen'}
                {showAllSessions ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>
            </div>
            <div className="rounded-md border border-border overflow-hidden">
              <div className="max-h-[260px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">
                        Datum
                      </th>
                      <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">
                        Tag
                      </th>
                      <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">
                        Uhr
                      </th>
                      <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">
                        Grund
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showAllSessions ? sessions.sample : sessions.sample.slice(0, 12)).map(
                      (s, i) => (
                        <tr
                          key={`${s.date}-${s.hour}-${i}`}
                          className={cn(
                            'border-t border-border',
                            !s.wouldCreate && 'bg-amber-50/40'
                          )}
                        >
                          <td className="px-2 py-1.5 tabular-nums">{s.date}</td>
                          <td className="px-2 py-1.5">
                            {['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][s.dayOfWeek] ?? '?'}
                          </td>
                          <td className="px-2 py-1.5 tabular-nums">
                            {String(s.hour).padStart(2, '0')}:00
                          </td>
                          <td className="px-2 py-1.5">
                            {s.wouldCreate ? (
                              <Badge className="bg-green-100 text-green-700 text-[10px] h-4">
                                Erstellen
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-700 text-[10px] h-4">
                                Überspringen
                              </Badge>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground">
                            {s.skipReason === 'holiday' && s.holidayNames.length > 0
                              ? s.holidayNames.join(', ')
                              : (s.skipReason ?? '—')}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Non-blocking Warnings ═══ */}
        {warnings.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
              <Info className="h-4 w-4" />
              Hinweise
            </h4>
            {warnings.map((w, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-md border px-3 py-2 text-xs flex items-start gap-2',
                  w.level === 'warning'
                    ? 'border-amber-300 bg-amber-50/30 text-amber-800'
                    : 'border-blue-300 bg-blue-50/30 text-blue-800'
                )}
              >
                {w.level === 'warning' ? (
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                ) : (
                  <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                )}
                <span>{w.message}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground text-center pt-2 border-t">
          🧪 Dry-Run — keine Daten geschrieben. Klicke „Neu simulieren" nach jeder Plan-Änderung.
        </p>
      </CardContent>
    </Card>
  );
}

const SESSION_SAMPLE_CAP = 500;

// ============================================
// SUB-COMPONENTS
// ============================================

function KpiCard({
  icon,
  label,
  value,
  subtitle,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        highlight ? 'border-brand-primary/30 bg-brand-primary/5' : 'border-border bg-background'
      )}
    >
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p
        className={cn(
          'text-xl font-bold mt-1 tabular-nums',
          highlight ? 'text-brand-primary' : 'text-foreground'
        )}
      >
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function SeverityPill({
  severity,
  count,
  label,
}: {
  severity: keyof typeof SEVERITY_STYLES;
  count: number;
  label: string;
}) {
  const style = SEVERITY_STYLES[severity];
  const Icon = style.icon;
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-md border px-3 py-2',
        style.border,
        style.bg
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn('h-3.5 w-3.5', style.color)} />
        <span className={cn('font-medium', style.color)}>{label}</span>
      </div>
      <span
        className={cn(
          'text-lg font-bold tabular-nums',
          count > 0 ? style.color : 'text-muted-foreground'
        )}
      >
        {count}
      </span>
    </div>
  );
}

function FinancialKpi({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2',
        highlight ? 'border-brand-primary/30 bg-brand-primary/5' : 'border-border bg-background'
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'text-lg font-bold tabular-nums',
          highlight ? 'text-brand-primary' : 'text-foreground'
        )}
      >
        {value.toFixed(2)} €
      </p>
    </div>
  );
}

function ResourceRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded border border-border bg-background px-2 py-1.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

// ============================================
// RSVP PIE SECTION
// ============================================
const RSVP_PIE_DATA: ReadonlyArray<{
  key: 'accepted' | 'declined' | 'maybe' | 'pending' | 'unknown';
  label: string;
  color: string;
}> = [
  { key: 'accepted', label: 'Zusage', color: 'green-500' },
  { key: 'declined', label: 'Absage', color: 'red-500' },
  { key: 'maybe', label: 'Vielleicht', color: 'amber-500' },
  { key: 'pending', label: 'Wartet auf Antwort', color: 'blue-500' },
  { key: 'unknown', label: 'Unbekannt', color: 'gray-400' },
];

function RsvpPieSection({
  distribution,
}: {
  distribution: NonNullable<DryRunReport['rsvpDistribution']>;
}) {
  const chartData: PieChartDatum[] = RSVP_PIE_DATA.map((d) => ({
    key: d.key,
    label: d.label,
    value: distribution.counts[d.key] ?? 0,
    color: d.color,
  }));
  const acceptancePct = Math.round(distribution.acceptanceRate * 100);
  return (
    <div>
      <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Mail className="h-4 w-4 text-muted-foreground" />
        RSVP-Verteilung (bisherige Saison)
        <Badge variant="secondary" className="text-[10px] ml-1">
          {distribution.total} Antworten
        </Badge>
      </h4>
      <div className="grid gap-4 md:grid-cols-[auto_1fr] items-center">
        <PieChart
          data={chartData}
          size={132}
          strokeWidth={20}
          centerLabel={`${acceptancePct}%`}
          centerSubLabel="Zusage"
          ariaLabel={`RSVP-Verteilung: ${distribution.counts.accepted} Zusagen von ${distribution.total}`}
        />
        <div className="space-y-1.5">
          {RSVP_PIE_DATA.map((d) => {
            const count = distribution.counts[d.key] ?? 0;
            const pct = distribution.total > 0 ? Math.round((count / distribution.total) * 100) : 0;
            return (
              <div
                key={d.key}
                className="flex items-center justify-between gap-3 text-xs"
                data-testid={`rsvp-pie-row-${d.key}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      'inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0',
                      d.color.replace(/-(\d{3})$/, '-500') === 'green-500' && 'bg-green-500',
                      d.color === 'green-500' && 'bg-green-500',
                      d.color === 'red-500' && 'bg-red-500',
                      d.color === 'amber-500' && 'bg-amber-500',
                      d.color === 'blue-500' && 'bg-blue-500',
                      d.color === 'gray-400' && 'bg-gray-400'
                    )}
                    style={{
                      backgroundColor: (
                        {
                          'green-500': '#22c55e',
                          'red-500': '#ef4444',
                          'amber-500': '#f59e0b',
                          'blue-500': '#3b82f6',
                          'gray-400': '#9ca3af',
                        } as Record<string, string>
                      )[d.color],
                    }}
                  />
                  <span className="text-foreground truncate">{d.label}</span>
                </div>
                <div className="flex items-center gap-2 tabular-nums text-muted-foreground">
                  <span className="font-medium text-foreground">{count}</span>
                  <span className="text-[10px]">({pct}%)</span>
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground pt-1.5 border-t border-border/50">
            Stichprobe aus {distribution.sessionSampleSize} veröffentlichter
            {distribution.sessionSampleSize === 1 ? ' Session' : ' Sessions'} · Acceptance-Rate{' '}
            {acceptancePct}%
          </p>
        </div>
      </div>
    </div>
  );
}

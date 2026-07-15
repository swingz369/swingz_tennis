'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { AlertTriangle, FileWarning, TrendingUp, Clock, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/format';
import type { DunningRecord, DunningStatus } from '@/lib/types/billing';

interface DunningKpis {
  totalRecords: number;
  thisMonthCount: number;
  totalInterest: number;
  openRecords: number;
  openAmount: number;
  byLevel: { level1: number; level2: number; level3: number };
  overdueInvoices: number;
}

interface DunningResponse {
  records: DunningRecord[];
  kpis: DunningKpis;
}

interface DunningOverviewProps {
  clubId: string;
  /** Optional: max records to display (default 10). */
  limit?: number;
}

const STATUS_STYLES: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'success' | 'error' | 'warning' }
> = {
  sent: { label: 'Versendet', variant: 'warning' },
  paid: { label: 'Bezahlt', variant: 'success' },
  escalated: { label: 'Eskaliert', variant: 'error' },
  cancelled: { label: 'Storniert', variant: 'secondary' },
};

function statusOf(r: DunningRecord): DunningStatus {
  const s = (r.status ?? 'sent') as DunningStatus;
  return s;
}

export function DunningOverview({ clubId, limit = 10 }: DunningOverviewProps) {
  const [data, setData] = useState<DunningResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/billing/dunning?clubId=${encodeURIComponent(clubId)}`);
        if (!res.ok) {
          if (!cancelled) toast.error('Mahnlauf-Daten konnten nicht geladen werden');
          return;
        }
        const json = (await res.json()) as DunningResponse;
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error('Netzwerkfehler beim Laden des Mahnlaufs');
          setLoading(false);
        }
        void err;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  if (loading || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const { kpis, records } = data;
  const recent = records.slice(0, limit);

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={Clock}
          label="Diesen Monat"
          value={kpis.thisMonthCount.toString()}
          hint={kpis.thisMonthCount === 1 ? 'Mahnung' : 'Mahnungen'}
          tone="amber"
        />
        <KpiCard
          icon={FileWarning}
          label="Offen"
          value={kpis.openRecords.toString()}
          hint={formatCurrency(kpis.openAmount)}
          tone="red"
        />
        <KpiCard
          icon={TrendingUp}
          label="Verzugszinsen"
          value={formatCurrency(kpis.totalInterest)}
          hint={`§288 BGB, Stufen 1–${kpis.byLevel.level1 + kpis.byLevel.level2 + kpis.byLevel.level3}`}
          tone="purple"
        />
        <KpiCard
          icon={Receipt}
          label="Überfällige Rechnungen"
          value={kpis.overdueInvoices.toString()}
          hint={kpis.overdueInvoices > 0 ? 'im Mahnzeitraum' : 'keine'}
          tone={kpis.overdueInvoices > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Level breakdown */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Mahnschritte:</span>
        {[
          { key: 'level1', label: '1. Mahnung', value: kpis.byLevel.level1 },
          { key: 'level2', label: '2. Mahnung', value: kpis.byLevel.level2 },
          { key: 'level3', label: '3. Mahnung (Anwalt)', value: kpis.byLevel.level3 },
        ].map((l) => (
          <Badge key={l.key} variant={l.value > 0 ? 'warning' : 'secondary'} className="text-xs">
            {l.label}: <span className="ml-1 font-bold tabular-nums">{l.value}</span>
          </Badge>
        ))}
      </div>

      {/* Recent records */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning-500" />
            Letzte Mahnungen ({recent.length} von {kpis.totalRecords})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Keine Mahnungen"
              description="Es wurden noch keine Mahnungen versendet. Sobald Rechnungen überfällig sind, werden hier Mahnstufen angezeigt."
            />
          ) : (
            <div className="divide-y divide-border">
              {recent.map((r) => {
                const stKey = statusOf(r);
                const st = STATUS_STYLES[stKey] ?? STATUS_STYLES.sent;
                const lvl = Number(r.level ?? 0);
                const totalDue = Number(r.total_due ?? r.total_amount ?? 0);
                const interest = Number(r.interest_amount ?? 0);
                return (
                  <div
                    key={r.id}
                    className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={st.variant} className="text-xs">
                          {st.label}
                        </Badge>
                        {lvl > 0 && (
                          <Badge variant="outline" className="text-xs">
                            Stufe {lvl}
                          </Badge>
                        )}
                        {r.is_b2b && (
                          <Badge variant="outline" className="text-2xs">
                            §288 Abs. 2 BGB
                          </Badge>
                        )}
                        {interest > 0 && (
                          <Badge variant="secondary" className="text-2xs">
                            + {formatCurrency(interest)} Zinsen
                          </Badge>
                        )}
                      </div>
                      {r.notes && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{r.notes}</p>
                      )}
                      <p className="text-2xs text-muted-foreground mt-0.5">
                        {r.sent_at && <>Versendet {formatRelativeTime(r.sent_at)}</>}
                        {r.due_date && (
                          <>
                            {' · '}Frist {formatDate(r.due_date)}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold tabular-nums">{formatCurrency(totalDue)}</p>
                      {r.base_rate_applied !== null && r.base_rate_applied > 0 && (
                        <p className="text-2xs text-muted-foreground tabular-nums">
                          Basis {(Number(r.base_rate_applied) * 100).toFixed(2)} %
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: string;
  hint?: string;
  tone: 'amber' | 'red' | 'purple' | 'green';
}) {
  const toneClass = {
    amber: 'bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-400',
    red: 'bg-error-50 dark:bg-error-900/20 text-error-600 dark:text-error-400',
    purple: 'bg-info-50 dark:bg-info-900/20 text-info-600 dark:text-info-400',
    green: 'bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400',
  }[tone];

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg mb-2.5 ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
        <p className="text-xs font-medium mt-0.5">{label}</p>
        {hint && <p className="text-2xs text-muted-foreground mt-1 line-clamp-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

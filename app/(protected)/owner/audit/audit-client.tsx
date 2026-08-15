'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollText, Filter, Download, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import { auditSubject, auditDetailLines } from '@/lib/audit-labels';
import { useRouter, useSearchParams } from 'next/navigation';

interface ClubOption {
  id: string;
  name: string;
  status: string;
}

interface AuditLog {
  id: string;
  created_at: string;
  actor_id: string;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  club_id: string | null;
  club_name: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
}

interface PaginationMeta {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextPage: number | null;
  prevPage: number | null;
  offset: number;
}

// Hardcoded Liste der wirklich häufigen Actions und Resources. Filter sind
// exakte EQ-Matches — Unbekanntes wird vom Backend schlicht nicht gefunden.
// Bei Bedarf später um "Benutzerdefinierte Aktion eingeben" erweitern.
const COMMON_ACTIONS = [
  'create',
  'update',
  'delete',
  'deactivate',
  'reactivate',
  'login',
  'logout',
  'invite',
  'restripe',
  'PII_READ',
] as const;

const COMMON_RESOURCE_TYPES = [
  'club',
  'user',
  'booking',
  'invoice',
  'session',
  'membership',
  'club_access_request',
  'system_settings',
  'trainer',
  'subscription',
  'audit_log',
  'season',
] as const;

const DEFAULT_LIMIT = 50;

export function OwnerAuditClient({ clubOptions }: { clubOptions: ClubOption[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filter-State direkt aus URL parametrisieren — damit Back-Button / Sharing funktioniert
  const filters = useMemo(
    () => ({
      club_id: searchParams.get('club_id') ?? '',
      actor_email: searchParams.get('actor_email') ?? '',
      action: searchParams.get('action') ?? '',
      resource_type: searchParams.get('resource_type') ?? '',
      from: searchParams.get('from') ?? '',
      to: searchParams.get('to') ?? '',
      page: Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1),
    }),
    [searchParams]
  );

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const updateFilters = useCallback(
    (patch: Partial<typeof filters>) => {
      const merged = { ...filters, ...patch };
      // Filter-Änderungen springen zurück auf Seite 1
      if (Object.keys(patch).some((k) => k !== 'page')) merged.page = 1;
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(merged)) {
        if (v && String(v).length > 0) params.set(k, String(v));
      }
      startTransition(() => router.push(`?${params.toString()}`));
    },
    [filters, router, startTransition]
  );

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.club_id) params.set('club_id', filters.club_id);
      if (filters.actor_email) params.set('actor_email', filters.actor_email);
      if (filters.action) params.set('action', filters.action);
      if (filters.resource_type) params.set('resource_type', filters.resource_type);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      params.set('page', String(filters.page));
      params.set('limit', String(DEFAULT_LIMIT));

      const res = await apiFetch(`/api/owner/audit-logs?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLogs(data.logs ?? []);
      setPagination(data.pagination ?? null);
    } catch {
      // Logger ist server-only und würde den Client-Bundle brechen.
      // toast.error liefert dem User die UX-Feedback; technische Details
      // landen ohnehin in der Browser-Konsole.
      toast.error('Audit-Logs konnten nicht geladen werden');
      setLogs([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const resetFilters = () =>
    updateFilters({
      club_id: '',
      actor_email: '',
      action: '',
      resource_type: '',
      from: '',
      to: '',
      page: 1,
    });

  const exportCsv = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.club_id) params.set('club_id', filters.club_id);
    if (filters.actor_email) params.set('actor_email', filters.actor_email);
    if (filters.action) params.set('action', filters.action);
    if (filters.resource_type) params.set('resource_type', filters.resource_type);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    // Direkt im Browser — kein Page-Reload, kein Routing-Wechsel.
    window.location.href = `/api/owner/audit-logs/export?${params.toString()}`;
  }, [filters]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 items-start">
      {/* Filter-Sidebar */}
      <Card className="lg:sticky lg:top-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="f-club" className="text-xs">
              Verein
            </Label>
            <select
              id="f-club"
              value={filters.club_id}
              onChange={(e) => updateFilters({ club_id: e.target.value })}
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Alle Vereine</option>
              {clubOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.status === 'deleted'
                    ? ' (gelöscht)'
                    : c.status === 'suspended'
                      ? ' (suspended)'
                      : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-actor" className="text-xs">
              Akteur-E-Mail
            </Label>
            <Input
              id="f-actor"
              type="search"
              placeholder="z. B. @tsv-dortmund.de"
              value={filters.actor_email}
              onChange={(e) => updateFilters({ actor_email: e.target.value })}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-action" className="text-xs">
              Aktion
            </Label>
            <select
              id="f-action"
              value={filters.action}
              onChange={(e) => updateFilters({ action: e.target.value })}
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Alle Aktionen</option>
              {COMMON_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-resource" className="text-xs">
              Ressource
            </Label>
            <select
              id="f-resource"
              value={filters.resource_type}
              onChange={(e) => updateFilters({ resource_type: e.target.value })}
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Alle Ressourcen</option>
              {COMMON_RESOURCE_TYPES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="f-from" className="text-xs">
                Von
              </Label>
              <Input
                id="f-from"
                type="date"
                value={filters.from}
                onChange={(e) => updateFilters({ from: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-to" className="text-xs">
                Bis
              </Label>
              <Input
                id="f-to"
                type="date"
                value={filters.to}
                onChange={(e) => updateFilters({ to: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="flex-1"
              type="button"
            >
              Zurücksetzen
            </Button>
          </div>

          <div className="pt-2 border-t border-border dark:border-white/10">
            <Button
              variant="default"
              size="sm"
              onClick={exportCsv}
              className="w-full gap-2"
              type="button"
            >
              <Download className="h-4 w-4" /> CSV-Export (max 10.000)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabelle */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ScrollText className="h-4 w-4" />
              Audit-Einträge
              {pagination && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {pagination.totalCount.toLocaleString('de-DE')} insgesamt
                </Badge>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void fetchLogs()}
              className="gap-1 text-xs"
              type="button"
              disabled={loading || isPending}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Aktualisieren
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && logs.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Keine Audit-Einträge für die gewählten Filter.
            </div>
          )}

          {!loading && logs.length > 0 && (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border dark:border-white/10 text-left">
                    <th className="px-2 py-2 font-medium text-xs text-muted-foreground w-44">
                      Zeit
                    </th>
                    <th className="px-2 py-2 font-medium text-xs text-muted-foreground">Akteur</th>
                    <th className="px-2 py-2 font-medium text-xs text-muted-foreground">Verein</th>
                    <th className="px-2 py-2 font-medium text-xs text-muted-foreground">Aktion</th>
                    <th className="px-2 py-2 font-medium text-xs text-muted-foreground">
                      Ressource
                    </th>
                    <th className="px-2 py-2 font-medium text-xs text-muted-foreground hidden 2xl:table-cell">
                      IP
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((logEntry) => (
                    <tr
                      key={logEntry.id}
                      className="border-b border-border/40 dark:border-white/5 hover:bg-muted/40 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="px-2 py-2 text-xs whitespace-nowrap text-muted-foreground">
                        {formatDateTime(logEntry.created_at)}
                      </td>
                      <td className="px-2 py-2 text-xs">
                        <div className="font-medium text-foreground truncate max-w-[180px]">
                          {logEntry.actor_name ?? logEntry.actor_email ?? '—'}
                        </div>
                        <div className="text-muted-foreground truncate max-w-[180px]">
                          {logEntry.actor_email ?? logEntry.actor_id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {logEntry.club_name ?? (
                          <span className="text-muted-foreground italic">plattformweit</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs">
                        <ActionBadge action={logEntry.action} />
                      </td>
                      {/* Vorher stand hier `resource_type · <erste 8 Zeichen der
                          UUID>` — eine Kennung, mit der niemand etwas anfangen
                          kann. Jetzt: benanntes Objekt plus die erklärenden
                          Felder aus `details`. */}
                      <td className="px-2 py-2 text-xs">
                        <div className="font-medium text-foreground truncate max-w-[280px]">
                          {auditSubject(logEntry)}
                        </div>
                        {auditDetailLines(logEntry.details).length > 0 && (
                          <div className="text-muted-foreground truncate max-w-[280px]">
                            {auditDetailLines(logEntry.details)
                              .map((d) => `${d.label}: ${d.value}`)
                              .join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs font-mono text-muted-foreground hidden 2xl:table-cell">
                        {logEntry.ip_address ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 mt-4 pt-4 border-t border-border dark:border-white/10">
              <div className="text-xs text-muted-foreground">
                Seite {pagination.page} von {pagination.totalPages} ·{' '}
                {pagination.totalCount.toLocaleString('de-DE')} Einträge
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasPrev || loading}
                  onClick={() => updateFilters({ page: pagination.page - 1 })}
                  type="button"
                  className="gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Zurück
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasNext || loading}
                  onClick={() => updateFilters({ page: pagination.page + 1 })}
                  type="button"
                  className="gap-1"
                >
                  Weiter <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  // Subtile Farbcodierung nach Action-Klasse — verbessert Scannability großer Listen
  let className = 'bg-muted text-muted-foreground border-border';
  if (/create|invite|restripe|reactivate/.test(action)) {
    className =
      'bg-success-50 text-success-700 border-success-200 dark:bg-success-900/20 dark:text-success-300 dark:border-success-800';
  } else if (/update/.test(action)) {
    className =
      'bg-info-50 text-info-700 border-info-200 dark:bg-info-900/20 dark:text-info-300 dark:border-info-800';
  } else if (/delete|deactivate|suspend/.test(action)) {
    className =
      'bg-warning-50 text-warning-700 border-warning-200 dark:bg-warning-900/20 dark:text-warning-300 dark:border-warning-800';
  } else if (/login|logout|PII_READ/.test(action)) {
    className =
      'bg-error-50 text-error-700 border-error-200 dark:bg-error-900/20 dark:text-error-300 dark:border-error-800';
  }

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono border ${className}`}
    >
      {action}
    </span>
  );
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Europe/Berlin',
    }).format(d);
  } catch {
    return iso;
  }
}

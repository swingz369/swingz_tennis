'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RefreshCw, Activity, ExternalLink, Database, AlertCircle } from 'lucide-react';
import { PerfHistoryChart } from './perf-history-chart';
import { apiFetch } from '@/lib/api-fetch';

type Source = 'local' | 'github';

interface LocalPayload {
  generatedAt: string;
  sources: {
    fixedBench: { available: boolean; error?: string };
    scalingBench: { available: boolean; error?: string };
  };
  points: PerfPoint[];
}

interface GithubPayload {
  generatedAt: string;
  source: 'github';
  runs: Array<{
    runId: string;
    name: string;
    branch: string;
    headSha: string;
    status: string;
    conclusion: string | null;
    createdAt: string;
    updatedAt: string;
    htmlUrl: string;
    points: PerfPoint[];
  }>;
  error?: string;
}

export interface PerfPoint {
  source: 'local-bench' | 'local-scaling' | 'github';
  runId: string;
  label: string;
  timestamp: string;
  numMembers: number | null;
  numTrainers: number | null;
  numCourts: number | null;
  meanMs: number;
  minMs: number | null;
  maxMs: number | null;
  totalGroups: number | null;
  unassignedCount: number | null;
  wishPartnerRate: number | null;
}

const SOURCE_COLORS: Record<PerfPoint['source'], string> = {
  'local-bench': '#1B4332',
  'local-scaling': '#40916C',
  github: '#7C3AED',
};

export function PerfHistoryClient() {
  const [source, setSource] = useState<Source>('local');
  const [localData, setLocalData] = useState<LocalPayload | null>(null);
  const [githubData, setGithubData] = useState<GithubPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      if (source === 'local') {
        if (!localData) {
          const res = await apiFetch('/api/admin/perf-history/local');
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${await res.text()}`);
          }
          const data = (await res.json()) as LocalPayload;
          setLocalData(data);
        }
      } else {
        const res = await apiFetch('/api/admin/perf-history/github');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }
        const data = (await res.json()) as GithubPayload;
        setGithubData(data);
      }
      setLastFetched(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const points = useMemo<PerfPoint[]>(() => {
    if (source === 'local') {
      return localData?.points ?? [];
    }
    return (githubData?.runs ?? []).flatMap((r) => r.points);
  }, [source, localData, githubData]);

  const sourceErrors = useMemo(() => {
    if (source !== 'local' || !localData) return [];
    const errs: { label: string; msg: string }[] = [];
    if (!localData.sources.fixedBench.available && localData.sources.fixedBench.error) {
      errs.push({ label: 'Lokal (fixed)', msg: localData.sources.fixedBench.error });
    }
    if (!localData.sources.scalingBench.available && localData.sources.scalingBench.error) {
      errs.push({ label: 'Lokal (scaling)', msg: localData.sources.scalingBench.error });
    }
    return errs;
  }, [source, localData]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card variant="bordered" className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div
            role="tablist"
            aria-label="Datenquelle"
            className="inline-flex rounded-lg border border-border/60 dark:border-white/10 p-1 bg-muted/40 dark:bg-background/40"
          >
            <button
              type="button"
              role="tab"
              aria-selected={source === 'local'}
              onClick={() => setSource('local')}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                source === 'local'
                  ? 'bg-background dark:bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Database className="h-4 w-4" />
              Lokal
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={source === 'github'}
              onClick={() => setSource('github')}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                source === 'github'
                  ? 'bg-background dark:bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ExternalLink className="h-4 w-4" />
              GitHub
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {lastFetched && <span>Letztes Update: {lastFetched.toLocaleTimeString('de-DE')}</span>}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (source === 'local') setLocalData(null);
                void load();
              }}
              disabled={loading}
              aria-label="Daten neu laden"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Neu laden
            </Button>
          </div>
        </div>
      </Card>

      {/* Error banner */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Daten konnten nicht geladen werden</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Soft source-availability warnings (local only) */}
      {sourceErrors.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Teilweise Daten verfügbar</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1 mt-1">
              {sourceErrors.map((e) => (
                <li key={e.label}>
                  <span className="font-medium">{e.label}:</span> {e.msg}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Chart */}
      <Card variant="bordered" className="p-4 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-brand-primary" />
          <h2 className="text-lg font-semibold">Clustering-Benchmarks (mean ms)</h2>
        </div>
        <div className="h-[420px] w-full">
          {loading ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              Lade Performance-Daten…
            </div>
          ) : points.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center px-4">
              <Database className="h-10 w-10 mb-2 opacity-50" />
              <p className="font-medium">Keine Datenpunkte gefunden</p>
              <p className="text-sm mt-1">
                {source === 'local'
                  ? 'Führe zuerst lokal einen Bench aus (npm run bench) oder prüfe, ob tests/bench/.bench-results.json existiert.'
                  : 'Es wurden noch keine perf-bench.yml-Läufe in GitHub Actions gefunden, oder es ist keine GITHUB_TOKEN-Env konfiguriert.'}
              </p>
            </div>
          ) : (
            <PerfHistoryChart points={points} colors={SOURCE_COLORS} />
          )}
        </div>
      </Card>

      {/* Raw table */}
      {points.length > 0 && (
        <Card variant="bordered" className="p-4 md:p-6 overflow-x-auto">
          <h3 className="text-sm font-semibold mb-3">Roh-Daten ({points.length})</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border/60 dark:border-white/10">
                <th className="py-2 pr-3 font-medium">Zeitpunkt</th>
                <th className="py-2 pr-3 font-medium">Label</th>
                <th className="py-2 pr-3 font-medium">Quelle</th>
                <th className="py-2 pr-3 font-medium text-right">Members</th>
                <th className="py-2 pr-3 font-medium text-right">mean (ms)</th>
                <th className="py-2 pr-3 font-medium text-right">min</th>
                <th className="py-2 pr-3 font-medium text-right">max</th>
                <th className="py-2 pr-3 font-medium text-right">unassigned</th>
              </tr>
            </thead>
            <tbody>
              {points
                .slice()
                .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                .slice(0, 50)
                .map((p, i) => (
                  <tr
                    key={`${p.runId}-${i}`}
                    className="border-b border-border/30 dark:border-white/5 hover:bg-muted/40 dark:hover:bg-background/40"
                  >
                    <td className="py-2 pr-3 tabular-nums">
                      {new Date(p.timestamp).toLocaleString('de-DE')}
                    </td>
                    <td className="py-2 pr-3 font-mono text-[11px]">{p.label}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{p.source}</td>
                    <td className="py-2 pr-3 tabular-nums text-right">{p.numMembers ?? '—'}</td>
                    <td className="py-2 pr-3 tabular-nums text-right font-semibold">
                      {p.meanMs.toFixed(2)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-right text-muted-foreground">
                      {p.minMs != null ? p.minMs.toFixed(2) : '—'}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-right text-muted-foreground">
                      {p.maxMs != null ? p.maxMs.toFixed(2) : '—'}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-right text-muted-foreground">
                      {p.unassignedCount ?? '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {points.length > 50 && (
            <p className="text-xs text-muted-foreground mt-2">
              Zeige die 50 neuesten von {points.length} Datenpunkten.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

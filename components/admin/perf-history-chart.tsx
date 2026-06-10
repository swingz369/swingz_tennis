'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { PerfPoint } from './perf-history-client';

interface ChartProps {
  points: PerfPoint[];
  colors: Record<PerfPoint['source'], string>;
}

interface ChartRow {
  timestamp: string;
  timestampLabel: string;
  meanMs: number | null;
  minMs: number | null;
  maxMs: number | null;
  numMembers: number | null;
  series: string;
}

const SOURCE_LABELS: Record<PerfPoint['source'], string> = {
  'local-bench': 'Lokal (fixed 200m)',
  'local-scaling': 'Lokal (scaling)',
  github: 'GitHub Actions',
};

export function PerfHistoryChart({ points, colors }: ChartProps) {
  // Group points by series key (`source:numMembers`) and align by timestamp so
  // Recharts can render multiple lines on a shared X axis. When no
  // numMembers is present, we still bucket by source alone.
  const series = useMemo(() => {
    const groups = new Map<string, { points: PerfPoint[]; color: string; label: string }>();
    for (const p of points) {
      const key = p.numMembers != null ? `${p.source}::${p.numMembers}` : `${p.source}::single`;
      if (!groups.has(key)) {
        groups.set(key, {
          points: [],
          color: colors[p.source] ?? '#1B4332',
          label:
            p.numMembers != null
              ? `${SOURCE_LABELS[p.source]} (n=${p.numMembers})`
              : SOURCE_LABELS[p.source],
        });
      }
      groups.get(key)!.points.push(p);
    }
    return Array.from(groups.entries()).map(([key, value]) => ({ key, ...value }));
  }, [points, colors]);

  // Build chart rows: one row per unique timestamp
  const rows = useMemo<ChartRow[]>(() => {
    const tsMap = new Map<string, ChartRow>();
    for (const s of series) {
      for (const p of s.points) {
        const ts = p.timestamp;
        if (!tsMap.has(ts)) {
          tsMap.set(ts, {
            timestamp: ts,
            timestampLabel: new Date(ts).toLocaleString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            }),
            meanMs: null,
            minMs: null,
            maxMs: null,
            numMembers: p.numMembers,
            series: s.label,
          });
        }
      }
    }
    // Sort chronologically
    return Array.from(tsMap.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [series]);

  if (rows.length === 0 || series.length === 0) {
    return null;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 10, right: 24, left: 0, bottom: 10 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="currentColor"
          className="text-border/60 dark:text-white/10"
        />
        <XAxis
          dataKey="timestampLabel"
          tick={{ fontSize: 11 }}
          stroke="currentColor"
          className="text-muted-foreground"
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11 }}
          stroke="currentColor"
          className="text-muted-foreground"
          label={{
            value: 'ms',
            angle: -90,
            position: 'insideLeft',
            style: { fontSize: 11, fill: 'currentColor' },
          }}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: '1px solid var(--border, #e5e7eb)',
            backgroundColor: 'var(--background, #ffffff)',
            color: 'var(--foreground, #111827)',
            fontSize: 12,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
          labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          formatter={(value: number, name: string) => [`${value.toFixed(2)} ms`, name]}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="line" />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={(row: ChartRow) => {
              if (row.series !== s.label) return null;
              return row.meanMs;
            }}
            data={rows.map((r) => ({
              ...r,
              [s.label]: r.series === s.label ? r.meanMs : null,
            }))}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 3, fill: s.color }}
            activeDot={{ r: 5 }}
            connectNulls
            isAnimationActive
            animationDuration={800}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

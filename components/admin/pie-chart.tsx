'use client';

import { cn } from '@/lib/utils';

export interface PieChartDatum {
  /** Stable identifier, used as React key + aria-label. */
  key: string;
  /** Human-readable label for the legend. */
  label: string;
  /** Numeric value (>= 0). Zero values are dropped from the chart. */
  value: number;
  /** Tailwind color token, e.g. "green-500" or a hex like "#16a34a". */
  color: string;
}

interface Props {
  data: ReadonlyArray<PieChartDatum>;
  /** Outer diameter in px. Defaults to 120. */
  size?: number;
  /** Stroke width for the donut variant. Set to 0 for a solid pie. */
  strokeWidth?: number;
  /** Optional center text (e.g. "75%"). Hidden when not provided. */
  centerLabel?: string;
  centerSubLabel?: string;
  className?: string;
  /** Aria label for screen readers. */
  ariaLabel?: string;
}

const DEFAULT_COLORS = [
  '#16a34a', // green-600
  '#dc2626', // red-600
  '#d97706', // amber-600
  '#2563eb', // blue-600
  '#6b7280', // gray-500
  '#9333ea', // purple-600
];

/** Map a Tailwind token like "green-500" to a hex equivalent. */
function resolveColor(token: string, fallbackIndex: number): string {
  if (token.startsWith('#') || token.startsWith('rgb')) return token;
  const map: Record<string, string> = {
    'green-100': '#dcfce7',
    'green-200': '#bbf7d0',
    'green-300': '#86efac',
    'green-400': '#4ade80',
    'green-500': '#22c55e',
    'green-600': '#16a34a',
    'green-700': '#15803d',
    'red-100': '#fee2e2',
    'red-200': '#fecaca',
    'red-300': '#fca5a5',
    'red-400': '#f87171',
    'red-500': '#ef4444',
    'red-600': '#dc2626',
    'red-700': '#b91c1c',
    'amber-100': '#fef3c7',
    'amber-200': '#fde68a',
    'amber-300': '#fcd34d',
    'amber-400': '#fbbf24',
    'amber-500': '#f59e0b',
    'amber-600': '#d97706',
    'amber-700': '#b45309',
    'blue-100': '#dbeafe',
    'blue-200': '#bfdbfe',
    'blue-300': '#93c5fd',
    'blue-400': '#60a5fa',
    'blue-500': '#3b82f6',
    'blue-600': '#2563eb',
    'blue-700': '#1d4ed8',
    'gray-300': '#d1d5db',
    'gray-400': '#9ca3af',
    'gray-500': '#6b7280',
  };
  return map[token] ?? DEFAULT_COLORS[fallbackIndex % DEFAULT_COLORS.length];
}

export function PieChart({
  data,
  size = 120,
  strokeWidth = 18,
  centerLabel,
  centerSubLabel,
  className,
  ariaLabel = 'Donut chart',
}: Props) {
  const total = data.reduce((acc, d) => acc + Math.max(0, d.value), 0);
  const radius = size / 2;
  const innerRadius = strokeWidth > 0 ? radius - strokeWidth : 0;
  const circumference = 2 * Math.PI * (radius - strokeWidth / 2);

  if (total <= 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-muted/30 text-muted-foreground text-xs',
          className
        )}
        style={{ width: size, height: size }}
        aria-label="Keine Daten"
      >
        ∅
      </div>
    );
  }

  let cumulative = 0;
  const segments = data
    .filter((d) => d.value > 0)
    .map((d, i) => {
      const fraction = d.value / total;
      const dashLength = fraction * circumference;
      const dashGap = circumference - dashLength;
      const offset = -((cumulative / total) * circumference);
      cumulative += d.value;
      const stroke = resolveColor(d.color, i);
      return {
        key: d.key,
        label: d.label,
        value: d.value,
        color: stroke,
        fraction,
        dashArray: `${dashLength} ${dashGap}`,
        dashOffset: offset,
      };
    });

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={ariaLabel}
        className="overflow-visible"
      >
        {/* Background ring (subtle, helps the donut feel "empty" when total is low) */}
        <circle
          cx={radius}
          cy={radius}
          r={radius - strokeWidth / 2}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/40"
        />
        {/* Segments */}
        {strokeWidth > 0 ? (
          <g transform={`rotate(-90 ${radius} ${radius})`}>
            {segments.map((s) => (
              <circle
                key={s.key}
                cx={radius}
                cy={radius}
                r={radius - strokeWidth / 2}
                fill="none"
                stroke={s.color}
                strokeWidth={strokeWidth}
                strokeDasharray={s.dashArray}
                strokeDashoffset={s.dashOffset}
                strokeLinecap="butt"
              >
                <title>{`${s.label}: ${s.value} (${(s.fraction * 100).toFixed(0)}%)`}</title>
              </circle>
            ))}
          </g>
        ) : (
          // Solid pie fallback (not currently used, but kept for completeness)
          <g>
            {segments.map((s) => {
              const startAngle = ((cumulative - s.value) / total) * Math.PI * 2;
              const endAngle = (cumulative / total) * Math.PI * 2;
              cumulative += s.value;
              const x1 = radius + radius * Math.sin(startAngle);
              const y1 = radius - radius * Math.cos(startAngle);
              const x2 = radius + radius * Math.sin(endAngle);
              const y2 = radius - radius * Math.cos(endAngle);
              const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
              const path = `M ${radius} ${radius} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
              return <path key={s.key} d={path} fill={s.color} />;
            })}
          </g>
        )}
        {/* Inner mask for clean donut hole (visual polish) */}
        {innerRadius > 0 && (
          <circle cx={radius} cy={radius} r={innerRadius} fill="hsl(var(--background, white))" />
        )}
      </svg>
      {(centerLabel || centerSubLabel) && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ width: size, height: size }}
        >
          {centerLabel && (
            <span className="text-sm font-bold tabular-nums text-foreground">{centerLabel}</span>
          )}
          {centerSubLabel && (
            <span className="text-[10px] text-muted-foreground">{centerSubLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

import { cn } from '@/lib/utils';

/**
 * MiniChart — Lightweight sparkline for inline data visualization.
 *
 * Renders an SVG polyline chart — no external chart library needed.
 * Perfect for dashboard KPIs showing trends.
 *
 * @example
 * <MiniChart data={[10, 25, 15, 30, 20, 35]} />
 * <MiniChart data={[10, 25, 15, 30, 20, 35]} color="green" height={32} />
 * <MiniChart data={[10, 25, 15, 30, 20, 35]} showTrend />
 */

interface MiniChartProps {
  /** Numeric data points */
  data: number[];
  /** Chart width (default: 80) */
  width?: number;
  /** Chart height (default: 28) */
  height?: number;
  /** Stroke color (default: brand-light) */
  color?: 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'brand';
  /** Show fill under the line */
  showFill?: boolean;
  /** Show trend indicator (arrow + percentage) */
  showTrend?: boolean;
  className?: string;
}

const CHART_COLORS: Record<string, { stroke: string; fill: string }> = {
  blue: { stroke: '#3B82F6', fill: 'rgba(59,130,246,0.1)' },
  green: { stroke: '#10B981', fill: 'rgba(16,185,129,0.1)' },
  red: { stroke: '#EF4444', fill: 'rgba(239,68,68,0.1)' },
  purple: { stroke: '#8B5CF6', fill: 'rgba(139,92,246,0.1)' },
  orange: { stroke: '#F97316', fill: 'rgba(249,115,22,0.1)' },
  brand: { stroke: '#5D8C3E', fill: 'rgba(93,140,62,0.1)' },
};

export function MiniChart({
  data,
  width = 80,
  height = 28,
  color = 'brand',
  showFill = true,
  showTrend = false,
  className,
}: MiniChartProps) {
  if (!data || data.length < 2) return null;

  const colors = CHART_COLORS[color] ?? CHART_COLORS.brand;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data
    .map((v, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((v - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  // Fill polygon (closes at bottom)
  const fillPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

  // Trend calculation
  const trendPercent =
    data.length >= 2 ? Math.round(((data[data.length - 1] - data[0]) / (data[0] || 1)) * 100) : 0;
  const trendPositive = trendPercent >= 0;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <svg width={width} height={height} className="shrink-0">
        {showFill && <polygon points={fillPoints} fill={colors.fill} stroke="none" />}
        <polyline
          points={points}
          fill="none"
          stroke={colors.stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showTrend && (
        <span
          className={cn(
            'text-xs font-semibold tabular-nums',
            trendPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          )}
        >
          {trendPositive ? '↑' : '↓'} {Math.abs(trendPercent)}%
        </span>
      )}
    </div>
  );
}

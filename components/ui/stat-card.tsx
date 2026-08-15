import Link from 'next/link';
import { cn } from '@/lib/utils';
import { AnimatedCounter } from '@/components/animations';
import type { LucideIcon } from 'lucide-react';

/**
 * StatCard — Reusable KPI card component
 *
 * Inspired by TSOWAPP's StatCard pattern.
 * Used across admin dashboards for consistent stat display.
 *
 * @example
 * <StatCard
 *   icon={Users}
 *   label="Aktive Mitglieder"
 *   value="42"
 *   sub="aktive Mitglieder"
 *   color="blue"
 *   href="/admin/members"
 * />
 */

type StatColor = 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'gray' | 'brand';

const COLOR_MAP: Record<StatColor, { text: string; bg: string; border: string }> = {
  brand: {
    text: 'text-brand-light',
    bg: 'bg-brand-light/10 dark:bg-brand-light/20',
    border: 'hover:border-brand-light/30',
  },
  blue: {
    text: 'text-info-600 dark:text-info-400',
    bg: 'bg-info-50 dark:bg-info-900/30',
    border: 'hover:border-info-200 dark:hover:border-info-700/50',
  },
  green: {
    text: 'text-success-600 dark:text-success-400',
    bg: 'bg-success-50 dark:bg-success-900/30',
    border: 'hover:border-success-200 dark:hover:border-success-700/50',
  },
  purple: {
    text: 'text-info-600 dark:text-info-400',
    bg: 'bg-info-50 dark:bg-info-900/30',
    border: 'hover:border-info-200 dark:hover:border-info-700/50',
  },
  orange: {
    text: 'text-brand-accent-600 dark:text-brand-accent-400',
    bg: 'bg-brand-accent-50 dark:bg-brand-accent-900/20',
    border: 'hover:border-brand-accent-200 dark:hover:border-brand-accent-700/50',
  },
  red: {
    text: 'text-error-600 dark:text-error-400',
    bg: 'bg-error-50 dark:bg-error-900/20',
    border: 'hover:border-error-200 dark:hover:border-error-700/50',
  },
  gray: {
    text: 'text-muted-foreground dark:text-muted-foreground',
    bg: 'bg-muted dark:bg-card/5',
    border: 'hover:border-border dark:hover:border-white/10',
  },
};

/** Minimal inline sparkline — no charting library, just a normalized polyline. */
function Sparkline({ points, className }: { points: number[]; className?: string }) {
  // A flat series (all-zero, or no real growth data) renders as a
  // meaningless dash — worse than showing nothing.
  if (points.length < 2 || new Set(points).size < 2) return null;
  const width = 64;
  const height = 24;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points
    .map((p, i) => `${i * step},${height - ((p - min) / range) * (height - 2) - 1}`)
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('opacity-80', className)}
      aria-hidden="true"
    >
      <polyline
        points={coords}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  /** Alias for sub — used by existing components */
  sublabel?: string;
  color?: StatColor;
  href?: string;
  /** Show animated counter for numeric values */
  animate?: boolean;
  /** Suffix for animated counter (e.g. '%') */
  suffix?: string;
  /** Optional badge count shown top-right */
  badge?: number;
  /** Extra class for the icon container */
  iconClassName?: string;
  /** Extra class for the value text */
  valueClassName?: string;
  className?: string;
  /** Optional trend series rendered as a small inline sparkline */
  trend?: number[];
  /** Highlights this card as the dashboard's primary KPI — accent top
   * border + subtle tinted background. Use on at most one card per row. */
  featured?: boolean;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  sublabel,
  color = 'blue',
  href,
  animate = false,
  suffix = '',
  badge,
  iconClassName,
  valueClassName,
  className,
  trend,
  featured = false,
}: StatCardProps) {
  const colors = COLOR_MAP[color];

  const numericValue = typeof value === 'number' ? value : parseInt(String(value), 10);
  const isNumeric = !isNaN(numericValue);

  const content = (
    <div
      className={cn(
        // `h-full`: Karten mit Sparkline oder zweiter Zeile sind höher als die
        // übrigen. Ohne das blieben die kürzeren oben kleben statt die Zeilenhöhe
        // mitzugehen — die KPI-Reihe wirkte dadurch ausgefranst.
        'h-full bg-card dark:bg-card border border-border dark:border-white/10 rounded-xl shadow-sm cursor-pointer group transition-colors',
        colors.border,
        // Hervorgehobene Karte trägt die Aktionsfarbe, nicht den Signal-Ocker:
        // eine ockerne Oberkante neben einem grünen Kennzahlenband las sich wie
        // eine Warnung, gemeint war „das hier zuerst".
        featured &&
          'border-t-[3px] border-t-primary bg-gradient-to-b from-primary/[0.06] to-transparent',
        // Ohne `href` ist dieses div selbst das Grid-Kind und trägt die Layout-Klassen.
        !href && className
      )}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wide">
              {label}
            </p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <p
                className={cn(
                  'text-2xl font-bold font-mono text-foreground dark:text-white tabular-nums',
                  valueClassName
                )}
              >
                {animate && isNumeric ? (
                  <AnimatedCounter value={numericValue} suffix={suffix} />
                ) : (
                  value
                )}
              </p>
              {badge != null && badge > 0 && (
                <span
                  className={cn(
                    'text-2xs font-bold px-2 py-0.5 rounded-full',
                    colors.bg,
                    colors.text
                  )}
                >
                  {badge}
                </span>
              )}
            </div>
            {(sub || sublabel) && (
              <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-0.5">
                {sub || sublabel}
              </p>
            )}
            {trend && trend.length > 1 && (
              <Sparkline points={trend} className={cn('mt-2', colors.text)} />
            )}
          </div>
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl shrink-0',
              colors.bg,
              iconClassName
            )}
          >
            <Icon className={cn('h-5 w-5', colors.text)} />
          </div>
        </div>
      </div>
    </div>
  );

  if (href) {
    // `className` gehört hier auf den Link, nicht auf die Karte darin: mit `href`
    // ist der Link das Grid-Kind. Layout-Klassen wie `lg:col-span-2` landeten
    // vorher eine Ebene zu tief und wirkten nicht — im Admin-Dashboard blieb
    // dadurch die fünfte Spalte der KPI-Zeile leer.
    return (
      <Link href={href} className={cn('block h-full', className)}>
        {content}
      </Link>
    );
  }

  return content;
}

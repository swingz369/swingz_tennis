import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedCounter } from '@/components/animations';
import { IconBox } from '@/components/ui/icon-box';

type KpiTone = 'brand' | 'accent' | 'success' | 'neutral';

interface KpiItem {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: KpiTone;
  href?: string;
  /** Pct or short string (e.g. "+4%"). Optional. */
  delta?: string;
  /** Tone for the delta chip. Defaults to `success`. */
  deltaTone?: 'success' | 'muted' | 'warning';
  /** Locale-formatted prefix (e.g. "€") for currency values. */
  prefix?: string;
  /** Locale-formatted suffix (default empty). */
  suffix?: string;
}

const TONE_BG: Record<KpiTone, string> = {
  brand: 'hover:border-brand-light/40 hover:shadow-glow-primary',
  accent: 'hover:border-brand-accent/40 hover:shadow-glow-accent',
  success: 'hover:border-emerald-300/50',
  neutral: 'hover:border-white/10',
};

const TONE_ICON: Record<KpiTone, 'light' | 'orange' | 'green' | 'gray'> = {
  brand: 'light',
  accent: 'orange',
  success: 'green',
  neutral: 'gray',
};

const DELTA_TONE: Record<NonNullable<KpiItem['deltaTone']>, string> = {
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  muted: 'bg-muted text-muted-foreground',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

function KpiCell({ item }: { item: KpiItem }) {
  const tone = item.tone;
  const iconVariant = TONE_ICON[tone];
  const deltaTone = item.deltaTone ?? (tone === 'accent' ? 'warning' : 'success');

  const inner = (
    <div
      className={cn(
        'group relative min-w-[200px] sm:min-w-0 snap-start p-5 sm:p-6 rounded-2xl',
        // Surface — glass with subtle border
        'glass border border-border/60 dark:border-white/[0.06]',
        'transition-all duration-300 ease-out hover:-translate-y-0.5',
        TONE_BG[tone]
      )}
    >
      {/* Subtle decorative corner gradient */}
      <div
        className={cn(
          'absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-50 transition-opacity duration-700 pointer-events-none',
          tone === 'brand' && 'bg-brand-light/40',
          tone === 'accent' && 'bg-brand-accent/40',
          tone === 'success' && 'bg-emerald-400/40',
          tone === 'neutral' && 'bg-muted'
        )}
        aria-hidden="true"
      />

      <div className="relative flex items-start justify-between gap-3 mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {item.label}
        </p>
        <IconBox
          icon={item.icon}
          size="sm"
          variant={iconVariant}
          className="group-hover:scale-110 transition-transform duration-300"
        />
      </div>

      <div className="relative flex items-baseline gap-3">
        <span className="text-3xl sm:text-4xl font-mono font-bold text-foreground dark:text-white tracking-tighter tabular-nums leading-none">
          {item.prefix && (
            <span className="text-muted-foreground/60 text-xl sm:text-2xl mr-0.5 font-semibold">
              {item.prefix}
            </span>
          )}
          <AnimatedCounter value={item.value} suffix={item.suffix} />
        </span>
        {item.delta && (
          <span
            className={cn(
              'text-2xs font-bold px-2 py-0.5 rounded-full tabular-nums',
              DELTA_TONE[deltaTone]
            )}
          >
            {item.delta}
          </span>
        )}
      </div>

      {item.href && (
        <div className="relative mt-3 flex items-center gap-1 text-xs font-medium text-brand-light opacity-0 group-hover:opacity-100 transition-opacity">
          Details <span aria-hidden>→</span>
        </div>
      )}
    </div>
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-2xl"
      >
        {inner}
      </Link>
    );
  }

  return inner;
}

/**
 * AdminKpiStrip — Dense horizontal KPI strip, Linear/Vercel-inspired.
 *
 * On mobile (< sm), exposes a horizontal scroll-snap carousel so all 4 KPIs
 * fit on one row instead of stacking. From sm up it becomes a 2-col / 4-col grid.
 */
export function AdminKpiStrip({ items }: { items: KpiItem[] }) {
  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        // Mobile: horizontal scroll-snap carousel
        'flex gap-3 sm:gap-4 overflow-x-auto sm:overflow-visible',
        'snap-x snap-mandatory sm:snap-none',
        'hide-scrollbar sm:grid sm:grid-cols-2 lg:grid-cols-4',
        // Negative margin + padding for proper mobile inset
        '-mx-1 px-1 sm:mx-0 sm:px-0'
      )}
    >
      {items.map((item) => (
        <KpiCell key={item.label} item={item} />
      ))}
    </div>
  );
}

export type { KpiItem };

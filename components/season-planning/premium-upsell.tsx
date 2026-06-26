'use client';

/**
 * PremiumUpsell — Starter→Pro upgrade modal (Q1 Epic 1.2 — KI-Premium-Sichtbarkeit)
 *
 * Shown to Starter-tier clubs after the first successful lock-step so they
 * see the savings the AI unlocks *before* they ever upgrade. The modal never
 * blocks the publish flow — users can dismiss and continue with their work.
 *
 * Ticket: Q1.2.2 — "Modal nach erstem Lock-Step („Mit KI-Plan sparst du ~X Std")
 *   für Starter-Tier-Nutzer".
 *
 * Relationships:
 *   - Receives a `RoiStats` from `lib/season-planning/analytics.ts` (Q1.2.1)
 *   - Tier-gated by the parent: caller should pass `open === true` only when
 *     `isStarterTier(features)` evaluates true.
 *   - Uses the canonical `CenteredModal` — no second overlay stack to maintain.
 */

import Link from 'next/link';
import { Sparkles, Clock, Users, ShieldCheck, CheckCircle2, ArrowRight, X } from 'lucide-react';
import { CenteredModal } from '@/components/ui/centered-modal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RoiStats } from '@/lib/season-planning/analytics';

export interface PremiumUpsellProps {
  /** Whether the modal is open. Parent controls visibility based on tier + trigger. */
  open: boolean;
  /** Fired when the user dismisses the modal (button, overlay, Escape). */
  onClose: () => void;
  /** ROI stats computed via `computeRoiStats` from 1.2.1. */
  stats: RoiStats;
  /**
   * Pricing-page href. Defaults to `/pricing`. When the dedicated pricing
   * page is not yet available (1.2.3 still in TODO), the link still resolves —
   * Next.js will show a 404 which is acceptable for an opt-in kicker.
   */
  pricingHref?: string;
  /** Optional className for the inner content panel. */
  className?: string;
}

/**
 * Render the upsell modal. Pure presentational — no fetches, no global state.
 *
 * Layout (German copy + German labels — fits the rest of the admin UI):
 *   1. Hero with gradient icon + headline from stats
 *   2. 3 stat tiles (Konflikte / Trainer-Stunden / Mitglieder)
 *   3. Big savings line "Mit KI-Plan sparst du ~X Stunden"
 *   4. Bullet list of concrete benefits
 *   5. Dual CTA: "Pro entdecken" (primary) + "Vielleicht später" (dismiss)
 */
export function PremiumUpsell({
  open,
  onClose,
  stats,
  pricingHref = '/pricing',
  className,
}: PremiumUpsellProps) {
  return (
    <CenteredModal
      open={open}
      onClose={onClose}
      ariaLabel="Premium-Features entdecken"
      className={cn('max-w-lg', className)}
      overlayClassName="bg-gradient-to-br from-brand-secondary/60 via-brand-primary/30 to-brand-accent/40 backdrop-blur-md"
    >
      {/* ═══ Hero ═══ */}
      <div className="flex flex-col items-center text-center gap-2 -mt-2 mb-4">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-primary to-brand-accent text-white shadow-lg shadow-brand-accent/20">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          Deine KI-Trainerin hat gerade Vollgas gegeben
        </h2>
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">{stats.headline}</p>
      </div>

      {/* ═══ Stats grid ═══ */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatTile
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Konflikte vermieden"
          value={stats.conflictsResolved.toString()}
          accent="emerald"
        />
        <StatTile
          icon={<Clock className="h-4 w-4" />}
          label="Trainer-Stunden"
          value={stats.trainerHoursOptimized.toLocaleString('de-DE')}
          accent="blue"
        />
        <StatTile
          icon={<Users className="h-4 w-4" />}
          label="Mitglieder im Blick"
          value={stats.membersServed.toString()}
          accent="purple"
        />
      </div>

      {/* ═══ Big savings line ═══ */}
      <div className="rounded-xl border border-brand-accent/30 bg-gradient-to-br from-brand-accent/10 via-brand-primary/5 to-transparent p-4 mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-brand-primary tabular-nums">
            ~{stats.adminHoursSaved}
          </span>
          <span className="text-sm font-semibold text-foreground">Stunden</span>
          <span className="text-xs text-muted-foreground ml-auto">
            geschätzt (~{stats.estimatedSavingsEur} € Mehrwert)
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mt-1">
          Mit der KI-Planung sparst du im Vergleich zur manuellen Saisonplanung ungefähr so viel
          Verwaltungszeit.
        </p>
      </div>

      {/* ═══ Bullet list ═══ */}
      <ul className="space-y-2 mb-5">
        {stats.bullets.map((bullet, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{bullet}</span>
          </li>
        ))}
      </ul>

      {/* ═══ CTAs ═══ */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Button asChild variant="brand" className="flex-1 gap-2">
          <Link href={pricingHref}>
            <Sparkles className="h-4 w-4" />
            Pro entdecken
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="outline" onClick={onClose} className="gap-2">
          <X className="h-4 w-4" />
          Vielleicht später
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground text-center mt-3">
        Starter-Tier bleibt aktiv. KI-Hilfen sind optional in Pro enthalten.
      </p>
    </CenteredModal>
  );
}

function StatTile({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: 'emerald' | 'blue' | 'purple';
}) {
  // Tailwind stat-pill palette — explicit string-literal class names so the
  // JIT compiler can pick them up (no string-built classes).
  const accentStyles: Record<typeof accent, string> = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  };
  return (
    <div className={cn('rounded-lg border p-3', accentStyles[accent])}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium opacity-90">
        {icon}
        <span className="leading-tight">{label}</span>
      </div>
      <p className="text-xl font-bold tabular-nums mt-1.5">{value}</p>
    </div>
  );
}

import Link from 'next/link';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAdminDateLong } from '@/lib/utils/admin-date';

interface AdminPageTopbarProps {
  /** Page title — h1 (e.g. "Dashboard"). */
  title: string;
  /** Club / organisation name shown before the date in the subtitle. */
  clubName: string;
  /** Override the date subtitle. Defaults to today in Europe/Berlin. */
  pageDate?: Date;
  /**
   * Export action as a plain `<Link>` href. Wire to an internal route like
   * `/api/admin/dashboard/export` (route still to be added). When omitted,
   * the Export button is **not rendered** so the row stays clean — the
   * caller decides when the action is ready, no permanent disabled state.
   */
  exportHref?: string;
  /** Override the export button label (default: "Export"). */
  exportLabel?: string;
  /** Optional extra classes for the root. */
  className?: string;
}

/**
 * AdminPageTopbar — flat page topbar for the admin dashboard and similar
 * surfaces.
 *
 * Editorial-magazine topbar pattern mirrored from the design mockup:
 *
 *     [h1 ·{clubName} ·{date}]                       ... [Export]
 *
 * Replaces the dashboard's **page-context** dependency on the global
 * Header (`components/layout/header.tsx`, mounted by
 * `app/(protected)/protected-client-layout.tsx`): the page now owns its
 * own `h1`, datum subtitle, and Export action, while the global Header
 * still carries the global chrome — logo, ⌘K palette, theme toggle,
 * notifications, user menu.
 *
 * Layout contract:
 *   • `<header>` landmark — page-level chrome is semantically a header.
 *   • Single visual row on ≥ sm screens; rows wrap on phones.
 *   • `border-b` hairline separates bar from page content.
 *   • Server Component — no client hydration, h1 is the only landmark.
 *
 * Accessibility:
 *   • `h1` carries the page identity (one per dashboard route).
 *   • Subtitle is a plain `<p>` so screen-readers don't enter the
 *     landmark with a redundant second heading.
 *   • Export `<Link>` is the focusable target. When `exportHref` is unset
 *     the button isn't rendered at all, so no "disabled but visible"
 *     noise on routes that haven't wired the action yet.
 */
export function AdminPageTopbar({
  title,
  clubName,
  pageDate,
  exportHref,
  exportLabel = 'Export',
  className,
}: AdminPageTopbarProps) {
  const date = pageDate ?? new Date();
  // Berlin TZ + de-DE locale centralised in `lib/utils/admin-date.ts` so
  // server-rendered string matches what PremiumAdminHero clients would
  // expect for the same day.
  const formattedDate = formatAdminDateLong(date);

  return (
    <header
      className={cn(
        'flex flex-wrap items-end justify-between gap-3 sm:gap-4',
        'border-b border-border/60 dark:border-white/[0.06] pb-5',
        className
      )}
    >
      {/* Left: page identity (h1 + club · date subtitle) */}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground dark:text-white tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          <strong className="font-semibold text-foreground dark:text-white">{clubName}</strong>
          {' · '}
          {formattedDate}
        </p>
      </div>

      {/* Right: Export action. Rendered only when wired — no permanent
          disabled placeholder. */}
      {exportHref ? (
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={exportHref}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl',
              'border border-border bg-background text-foreground',
              'text-sm font-medium transition-colors hover:bg-muted',
              'dark:border-white/10 dark:hover:bg-card/5'
            )}
            // Server-rendered <a> — no JS required for the user gesture.
            prefetch={false}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {exportLabel}
          </Link>
        </div>
      ) : null}
    </header>
  );
}

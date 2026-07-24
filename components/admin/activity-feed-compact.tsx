import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/format';

/**
 * Canonical shape for one row in the dashboard's recent-activity feed.
 *
 * Lives here (not in a sibling "timeline component" file) because the
 * compact feed is now the only consumer — the heavier `AdminActivityTimeline`
 * Apple-style timeline was retired along with its file in favour of this
 * mockup-compass list, so the type migrated with the surviving component.
 */
export type TimelineActivityItem = {
  id: string;
  type: 'activity';
  title: string;
  subtitle: string;
  /** ISO datetime of the event. Drives the right-aligned relative time. */
  startISO: string;
  /** Anchor for the row's <Link>. Page renders a non-linkable row when empty. */
  href: string;
  /** Drives the dot accent: brand-light (bookings) vs emerald (joins). */
  variant: 'join' | 'booking';
};

interface ActivityFeedCompactProps {
  /** Recent-activity items (page.tsx maps join + booking events to this shape). */
  items: TimelineActivityItem[];
  /** Empty-state message rendered when `items` is empty. */
  emptyMessage?: string;
  /**
   * Optional "Alle anzeigen"-style footer link to a full-list route.
   * Rendered whenever set — even on empty items, so the user always has
   * a way out to the full list. Mockup-compass: text-only link, no
   * Chevron icon or type chip, right-aligned at the bottom.
   */
  footerHref?: string;
  /** Footer link text. Defaults to "Alle anzeigen". */
  footerLabel?: string;
  /** Optional extra classes for the `<ul>` root. */
  className?: string;
}

/**
 * ActivityFeedCompact — editorial-magazine compact activity list.
 *
 * Mirrors `dashboard-mockup.html`:
 *   • 6 px accent dot + title (truncated) + subtitle (muted, wrapping)
 *   • Relative time on the right (24 h weekday-aware, switches to
 *     `formatDateShort` past 7 days, courtesy of lib/format#formatRelativeTime)
 *   • Hairline divider between rows (first + last treated cleanly)
 *   • Whole row wraps in a `<Link>` when `href` is set with hover + focus states
 *
 * Compared to `AdminActivityTimeline`:
 *   • No tabs / no today's-sessions strip — pure recent-activity list.
 *   • Denser spacing (py-2.5 ≈ 10 px) for in-page panels.
 *   • No connector rail — the dot is the visual anchor.
 *   • No chevron or type chip — the visual density is the point.
 *
 * Server Component — pure render, no client interactivity needed.
 */
export function ActivityFeedCompact({
  items,
  emptyMessage = 'Noch keine Aktivitäten',
  footerHref,
  footerLabel = 'Alle anzeigen',
  className,
}: ActivityFeedCompactProps) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">{emptyMessage}</p>;
  }

  // Variant → dot accent. Mockup keeps a single accent dot, so we mirror
  // that for visual cohesion; switch back to per-variant accent if a
  // Panel later needs to differentiate join vs. booking at a glance.
  function dotClass(variant: TimelineActivityItem['variant']) {
    return variant === 'booking'
      ? 'bg-brand-light'
      : variant === 'join'
        ? 'bg-success-500'
        : 'bg-muted-foreground/60';
  }

  return (
    <>
      <ul
        role="list"
        className={cn('divide-y divide-border/60 dark:divide-white/[0.06]', className)}
      >
        {items.map((item) => {
          const body = (
            <div className="flex items-start gap-3 py-2.5">
              <span
                aria-hidden="true"
                className={cn('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', dotClass(item.variant))}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-foreground dark:text-white truncate">
                  {item.title}
                </p>
                {item.subtitle ? (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>
                ) : null}
              </div>
              <time
                dateTime={item.startISO}
                className="shrink-0 text-xs font-mono tabular-nums text-muted-foreground whitespace-nowrap"
              >
                {formatRelativeTime(item.startISO)}
              </time>
            </div>
          );
          return (
            <li key={item.id}>
              {item.href ? (
                <Link
                  href={item.href}
                  className="block -mx-2 px-2 rounded-md transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:bg-muted/40"
                >
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
      {footerHref ? (
        <div className="mt-2 flex justify-end">
          <Link
            href={footerHref}
            className="text-xs font-medium text-muted-foreground hover:text-brand-light transition-colors px-1 py-0.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {footerLabel}
          </Link>
        </div>
      ) : null}
    </>
  );
}

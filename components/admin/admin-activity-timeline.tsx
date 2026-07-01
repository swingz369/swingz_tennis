'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calendar, Activity, ChevronRight, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTime, formatRelativeTime } from '@/lib/format';

/** Entries shown before the "N weitere anzeigen" toggle appears. */
const DEFAULT_VISIBLE_COUNT = 5;

export type TimelineSession = {
  id: string;
  type: 'session';
  /** Display name (court name) */
  title: string;
  /** Trainer name */
  subtitle?: string;
  /** ISO string of start time */
  startISO: string;
  /** ISO string of end time */
  endISO: string;
  href: string;
};

export type TimelineActivityItem = {
  id: string;
  type: 'activity';
  title: string;
  subtitle: string;
  startISO: string;
  href: string;
  variant: 'join' | 'booking';
};

export type TimelineEntry = TimelineSession | TimelineActivityItem;

/**
 * AdminActivityTimeline — Apple-style vertical timeline.
 *
 * Combines today's sessions and recent activity into a single chronological
 * feed. Empty state is celebratory ("Heute ist Ruhetag"), not apologetic.
 */
export function AdminActivityTimeline({
  totalCount,
  todaySessionCount,
  todaySessions,
  recentActivity,
}: {
  totalCount: number;
  todaySessionCount: number;
  todaySessions: TimelineSession[];
  recentActivity: TimelineActivityItem[];
}) {
  // Unified, chronological merge
  const all: TimelineEntry[] = [...todaySessions, ...recentActivity].sort(
    (a, b) => new Date(b.startISO).getTime() - new Date(a.startISO).getTime()
  );

  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? all : all.slice(0, DEFAULT_VISIBLE_COUNT);
  const hiddenCount = all.length - visible.length;

  if (all.length === 0) {
    return (
      <div className="relative flex flex-col items-center justify-center py-12 px-6 text-center">
        {/* Decorative dashed circle */}
        <div className="relative mb-5">
          <div
            className="absolute inset-0 rounded-full bg-brand-light/10 blur-2xl"
            aria-hidden="true"
          />
          <div className="relative h-20 w-20 rounded-full border-2 border-dashed border-brand-light/30 flex items-center justify-center bg-gradient-to-br from-brand-light/5 to-brand-primary/5">
            <Sparkles className="h-8 w-8 text-brand-light/70" />
          </div>
        </div>
        <p className="text-base font-display font-semibold text-foreground dark:text-white">
          Heute ist Ruhetag.
        </p>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-xs">
          Keine Sessions, keine Buchungen. Genieße die Pause — morgen geht&apos;s wieder los.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Connector line */}
      {visible.length > 1 && (
        <div
          className="absolute left-[27px] sm:left-[31px] top-2 bottom-2 w-px bg-gradient-to-b from-border via-border/40 to-transparent dark:from-white/10 dark:via-white/5"
          aria-hidden="true"
        />
      )}

      <ul className="flex flex-col">
        {visible.map((entry, idx) => {
          const isSession = entry.type === 'session';
          const isActivity = entry.type === 'activity';
          const isFirst = idx === 0;

          return (
            <li key={entry.id} className="relative">
              <Link
                href={entry.href}
                className={cn(
                  'group flex items-start gap-3 sm:gap-4 py-3 px-2 -mx-2 rounded-xl',
                  'transition-all duration-200 hover:bg-muted/40 dark:hover:bg-white/[0.04]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                )}
              >
                {/* Timeline dot */}
                <div className="relative z-10 shrink-0 mt-0.5">
                  <div
                    className={cn(
                      'h-6 w-6 sm:h-7 sm:w-7 rounded-full flex items-center justify-center ring-2 ring-background dark:ring-card',
                      isSession &&
                        'bg-brand-light/15 text-brand-light group-hover:bg-brand-light/25',
                      isActivity &&
                        entry.variant === 'join' &&
                        'bg-info-100 dark:bg-info-900/40 text-info-700 dark:text-info-300 group-hover:bg-info-200',
                      isActivity &&
                        entry.variant === 'booking' &&
                        'bg-brand-light/15 text-brand-light group-hover:bg-brand-light/25'
                    )}
                  >
                    {isSession ? (
                      <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    ) : entry.variant === 'join' ? (
                      <span className="text-2xs font-bold leading-none">
                        {entry.title.charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    )}
                  </div>
                  {!isFirst && (
                    <div
                      className="absolute left-1/2 -translate-x-1/2 -top-3 h-3 w-px bg-gradient-to-b from-transparent to-border dark:to-white/10"
                      aria-hidden="true"
                    />
                  )}
                </div>

                {/* Time + body */}
                <div className="flex-1 min-w-0 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {/* Top line: time + title */}
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-2xs font-mono font-bold text-muted-foreground tabular-nums tracking-wide shrink-0">
                        {isSession
                          ? formatTime(entry.startISO)
                          : formatRelativeTime(entry.startISO)}
                      </span>
                      <span
                        className={cn(
                          'text-sm font-semibold truncate',
                          'text-foreground dark:text-white'
                        )}
                      >
                        {entry.title}
                      </span>
                    </div>

                    {/* Subtitle */}
                    {((isSession && entry.subtitle) || isActivity) && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {isSession
                          ? `${formatTime(entry.startISO)} – ${formatTime(entry.endISO)}${
                              entry.subtitle ? ` · ${entry.subtitle}` : ''
                            }`
                          : entry.subtitle}
                      </p>
                    )}
                  </div>

                  {/* Type chip + chevron */}
                  <div className="flex items-center gap-2 shrink-0 mt-0.5">
                    {isActivity && (
                      <span
                        className={cn(
                          'text-2xs font-semibold px-2 py-0.5 rounded-full',
                          entry.variant === 'join'
                            ? 'bg-info-50 text-info-700 dark:bg-info-900/30 dark:text-info-300'
                            : 'bg-brand-light/10 text-brand-light'
                        )}
                      >
                        {entry.variant === 'join' ? 'Beitritt' : 'Buchung'}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-brand-light group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {all.length > DEFAULT_VISIBLE_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 w-full text-center text-xs font-medium text-brand-light hover:text-brand-primary transition-colors py-2"
        >
          {expanded ? 'Weniger anzeigen' : `${hiddenCount} weitere anzeigen`}
        </button>
      )}

      {/* Footer summary */}
      <div className="mt-4 pt-4 border-t border-border/50 dark:border-white/5 flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Activity className="h-3 w-3" />
          {totalCount} {totalCount === 1 ? 'Eintrag' : 'Einträge'} · {todaySessionCount} heute
        </span>
        <Link
          href="/admin/seasons"
          className="font-medium text-brand-light hover:text-brand-primary transition-colors flex items-center gap-1"
        >
          Alle anzeigen <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { CheckCircle2, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconBox } from '@/components/ui/icon-box';

export type AttentionAction = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone?: 'orange' | 'blue';
};

/**
 * AdminInboxBanner — Apple "Dynamic Island" inspired.
 *
 * Two states:
 *   - `urgent` (variant="urgent"): 1–3 attention items in a row
 *   - `inbox-zero` (variant="inbox-zero"): full-width celebratory banner
 *
 * Server-renderable, no client hooks. The pulsing effect on urgent cards is
 * pure CSS via existing `animate-ping` / `animate-pulse` utilities.
 */
export function AdminInboxBanner({
  variant,
  actions,
}: {
  variant: 'urgent' | 'inbox-zero';
  actions?: AttentionAction[];
}) {
  if (variant === 'inbox-zero') {
    return (
      <div className="rounded-2xl border border-border dark:border-white/10 bg-card">
        <div className="flex items-center gap-4 px-5 sm:px-6 py-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success-50 dark:bg-success-900/20 shrink-0">
            <CheckCircle2 className="h-6 w-6 text-success-600 dark:text-success-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-display font-semibold text-foreground dark:text-white">
              Alles erledigt.
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Keine offenen Aufgaben. Dein Dashboard ist sauber.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (variant !== 'urgent' || !actions || actions.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
        </span>
        Aufmerksamkeit benötigt
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {actions.map((action) => {
          const tone = action.tone ?? 'orange';
          const isUrgent = tone === 'orange';
          return (
            <Link
              key={`${action.href}-${action.label}`}
              href={action.href}
              className={cn(
                'group relative overflow-hidden rounded-2xl border p-4',
                'transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                isUrgent
                  ? 'border-orange-200/70 dark:border-orange-700/40 bg-gradient-to-br from-orange-50 via-warning-50 to-background dark:from-orange-900/20 dark:via-warning-900/10 dark:to-card'
                  : 'border-info-200/70 dark:border-info-700/40 bg-gradient-to-br from-info-50 via-indigo-50 to-background dark:from-info-900/20 dark:via-indigo-900/10 dark:to-card'
              )}
            >
              {/* Mesh bleed on hover */}
              <div
                className={cn(
                  'absolute inset-0 -z-10 opacity-0 group-hover:opacity-30 transition-opacity duration-500',
                  isUrgent
                    ? 'bg-[radial-gradient(circle_at_top_right,hsl(var(--brand-accent)/0.2),transparent_60%)]'
                    : 'bg-[radial-gradient(circle_at_top_right,hsl(217_90%_60%/0.2),transparent_60%)]'
                )}
                aria-hidden="true"
              />

              <div className="relative flex items-start gap-3">
                <div className="relative shrink-0">
                  <div
                    className={cn(
                      'absolute inset-0 rounded-xl blur-md opacity-50',
                      isUrgent ? 'bg-orange-400/40' : 'bg-info-400/40'
                    )}
                    aria-hidden="true"
                  />
                  <IconBox
                    icon={action.icon}
                    size="md"
                    variant={isUrgent ? 'orange' : 'blue'}
                    className="relative"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p
                      className={cn(
                        'text-sm font-semibold truncate',
                        isUrgent
                          ? 'text-orange-800 dark:text-orange-300'
                          : 'text-info-800 dark:text-info-300'
                      )}
                    >
                      {action.label}
                    </p>
                    {isUrgent && (
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
                      </span>
                    )}
                  </div>
                  <p
                    className={cn(
                      'text-xs mt-0.5 line-clamp-2',
                      isUrgent
                        ? 'text-orange-700 dark:text-orange-400'
                        : 'text-info-700 dark:text-info-400'
                    )}
                  >
                    {action.description}
                  </p>
                </div>
                <ArrowUpRight
                  className={cn(
                    'h-4 w-4 shrink-0 mt-0.5',
                    'group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform',
                    isUrgent ? 'text-orange-400' : 'text-info-400'
                  )}
                />
              </div>

              {/* Urgent: subtle pulsing indicator on border via accent-shadow ring */}
              {isUrgent && (
                <span
                  className="pointer-events-none absolute inset-0 -z-10 rounded-2xl ring-1 ring-orange-400/20 animate-pulse-glow"
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

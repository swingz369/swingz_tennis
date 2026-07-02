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
      <div className="relative overflow-hidden rounded-2xl border border-emerald-300/30 dark:border-emerald-700/30 shadow-sm">
        {/* Mesh background */}
        <div
          className="absolute inset-0 -z-10"
          aria-hidden="true"
          style={{
            background: `
              radial-gradient(ellipse 60% 80% at 0% 50%, hsl(150 70% 80% / 0.4) 0%, transparent 60%),
              radial-gradient(ellipse 50% 70% at 100% 50%, hsl(150 60% 70% / 0.25) 0%, transparent 60%),
              linear-gradient(135deg, hsl(150 50% 96%) 0%, hsl(150 40% 92%) 100%)
            `,
          }}
        />
        <div className="absolute inset-0 noise opacity-[0.025] -z-10" aria-hidden="true" />
        <div
          className="absolute inset-0 -z-10 opacity-30"
          aria-hidden="true"
          style={
            {
              backgroundImage:
                'radial-gradient(hsl(var(--brand-primary) / 0.05) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            } as React.CSSProperties
          }
        />

        <div className="relative flex items-center gap-4 px-5 sm:px-6 py-5">
          <div className="relative shrink-0">
            <div
              className="absolute inset-0 rounded-2xl bg-emerald-400/30 blur-xl animate-pulse-glow"
              aria-hidden="true"
            />
            <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
              <CheckCircle2 className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-display font-semibold text-emerald-900 dark:text-emerald-100">
              Alles erledigt.
            </p>
            <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-0.5">
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

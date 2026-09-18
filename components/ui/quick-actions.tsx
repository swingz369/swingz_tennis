import Link from 'next/link';
import { IconBox, type IconBoxVariant } from '@/components/ui/icon-box';
import type { LucideIcon } from 'lucide-react';

export interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  /** IconBox color variant */
  variant?: IconBoxVariant;
  /** Optional description (shown in 'detailed' mode) */
  description?: string;
}

interface QuickActionsProps {
  actions: QuickAction[];
  /** 'compact' = icon + label grid (mobile-first), 'detailed' = cards with description (admin) */
  mode?: 'compact' | 'detailed';
  /** Section label shown above the grid */
  label?: string;
  className?: string;
}

export function QuickActions({
  actions,
  mode = 'compact',
  label = 'Schnellzugriff',
  className,
}: QuickActionsProps) {
  if (mode === 'detailed') {
    return (
      <div className={className}>
        <h2 className="text-sm font-semibold text-foreground mb-3">{label}</h2>
        {/* Ein zusammenhängendes Raster statt einzeln schwebender Kacheln: eine
            Umrandung aussen, Haarlinien innen. Das ist dieselbe Idee wie beim
            KPI-Band — die Gruppe ist ein Objekt, nicht n Objekte. */}
        {/* Haarlinien als `ring` je Zelle, nicht als Rand oder als Lücke über
            einem gefärbten Grund: Ringe liegen ausserhalb der Box und
            überlappen sich mit denen der Nachbarzelle zu einer einzigen Linie,
            und der äussere Ring wird vom `overflow-hidden` des Rahmens
            weggeschnitten. Das bleibt beim Umbruch von 4 auf 2 Spalten richtig
            — und eine unbesetzte Zelle bleibt leer, statt (wie bei der
            gefärbten Lücke) als grauer Block stehenzubleiben. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 rounded-xl border border-border dark:border-white/10 overflow-hidden">
          {actions.map((action) => (
            <Link
              key={action.href + action.label}
              href={action.href}
              className="flex flex-col gap-1 bg-card p-4 ring-1 ring-border dark:ring-white/10 transition-colors hover:bg-muted/60"
            >
              <IconBox icon={action.icon} size="sm" variant={action.variant ?? 'light'} />
              <p className="mt-1 text-sm font-semibold text-foreground dark:text-white">
                {action.label}
              </p>
              {action.description && (
                <p className="text-sm text-muted-foreground">{action.description}</p>
              )}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // Compact mode — icon grid for member/trainer
  return (
    <div className={className}>
      <h2 className="text-sm font-semibold text-foreground mb-3">{label}</h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 rounded-xl border border-border dark:border-white/10 overflow-hidden">
        {actions.map((action) => (
          <Link
            key={action.href + action.label}
            href={action.href}
            className="flex flex-col items-center gap-2 bg-card px-2 py-4 ring-1 ring-border dark:ring-white/10 transition-colors hover:bg-muted/60 active:bg-muted"
          >
            <IconBox icon={action.icon} size="md" variant={action.variant ?? 'light'} />
            <span className="text-xs font-medium text-center leading-tight text-foreground">
              {action.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

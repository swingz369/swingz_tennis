import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
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
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
          {label}
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {actions.map((action) => (
            <Link key={action.href + action.label} href={action.href}>
              <div className="border border-border dark:border-white/10 shadow-sm hover:shadow-md transition-all cursor-pointer group rounded-xl h-full">
                <div className="p-5 flex flex-col gap-3 h-full">
                  <IconBox
                    icon={action.icon}
                    variant={action.variant ?? 'light'}
                    className="group-hover:scale-105 transition-transform"
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground dark:text-white">
                      {action.label}
                    </p>
                    {action.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                    )}
                  </div>
                  <div className="mt-auto flex items-center gap-1">
                    <span className="text-xs font-medium text-brand-light">Öffnen</span>
                    <ArrowUpRight className="h-3 w-3 text-brand-light" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // Compact mode — icon grid for member/trainer
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
        {label}
      </p>
      <div className="grid grid-cols-3 gap-2.5">
        {actions.map((action) => (
          <Link
            key={action.href + action.label}
            href={action.href}
            className="flex flex-col items-center gap-2 p-3.5 rounded-xl border border-border dark:border-white/10 shadow-sm hover:border-brand-light/30 hover:shadow-md transition-all active:scale-95 group"
          >
            <IconBox
              icon={action.icon}
              size="md"
              variant={action.variant ?? 'light'}
              className="group-hover:scale-110 transition-transform duration-300"
            />
            <span className="text-2xs font-semibold text-center leading-tight text-muted-foreground group-hover:text-foreground transition-colors">
              {action.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

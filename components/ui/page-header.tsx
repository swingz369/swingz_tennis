import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface PageHeaderAction {
  label: string;
  icon?: LucideIcon;
  href?: string;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive';
  disabled?: boolean;
}

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional description below the title (Text oder einfacher JSX-Inhalt) */
  description?: ReactNode;
  /** Action buttons rendered on the right (oder freier Knoten, z. B. Status-Select) */
  actions?: PageHeaderAction[] | ReactNode;
  /** Zurück-Link oberhalb des Titels (Detailseiten) */
  back?: { href: string; label: string };
  /** Badge neben dem Titel (z. B. Status) */
  badge?: ReactNode;
  /** Optional extra content rendered below the header */
  children?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  back,
  badge,
  children,
  className,
}: PageHeaderProps) {
  const actionList = Array.isArray(actions) ? actions : null;
  return (
    <div className={cn('space-y-3', className)}>
      {back && (
        <Link
          href={back.href}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      {/* Title row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* ── Typografische Hierarchie (18.08.2026) ──
            Vorher lag zwischen Seitentitel (text-2xl/24 px) und Fliesstext
            (text-sm/14 px) nicht genug Abstand, um beim Überfliegen als Ebene
            zu wirken — auf jedem Screen war alles ähnlich laut. Der Titel geht
            jetzt auf 30 px mit enger Laufweite (die Display-Schrift verträgt
            das und wirkt erst dadurch gesetzt statt fett), die Beschreibung
            wird etwas grösser, aber ruhig. */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="font-display text-[28px] sm:text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="text-[15px] leading-snug text-muted-foreground mt-1.5 max-w-[60ch]">
              {description}
            </p>
          )}
        </div>

        {/* Actions */}
        {actions && !actionList && (
          <div className="flex items-center gap-2 shrink-0">{actions as ReactNode}</div>
        )}
        {actionList && actionList.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            {actionList.map((action, i) => {
              const Icon = action.icon;
              const btnContent = (
                <>
                  {Icon && <Icon className="h-4 w-4" />}
                  {action.label}
                </>
              );

              if (action.href) {
                return (
                  <Button
                    key={i}
                    variant={action.variant ?? 'default'}
                    disabled={action.disabled}
                    asChild
                  >
                    <Link href={action.href}>{btnContent}</Link>
                  </Button>
                );
              }
              return (
                <Button
                  key={i}
                  variant={action.variant ?? 'default'}
                  onClick={action.onClick}
                  disabled={action.disabled}
                >
                  {btnContent}
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {/* Extra content (e.g. tabs, filters) */}
      {children}
    </div>
  );
}

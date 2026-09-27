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
  variant?: 'default' | 'highlight' | 'outline' | 'secondary' | 'ghost' | 'destructive';
  disabled?: boolean;
}

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Kleine Versalzeile über dem Titel — Bereich oder Datum (Matchday-Vorlage) */
  eyebrow?: ReactNode;
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
  eyebrow,
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
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        {/* ── Display-Titel (Matchday, ADR-007) ──
            Kursive Versalien in DM Sans Bold, eng gesetzt: der Titel ist die
            eine laute Ebene der Seite, alles darunter bleibt ruhig. Die
            Eyebrow darüber sagt, wo man ist (Bereich, Datum). */}
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {eyebrow}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-[32px] sm:text-[40px] lg:text-[44px] font-bold italic uppercase leading-[1.04] tracking-[-0.035em] text-foreground text-balance">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="text-[15px] leading-snug text-muted-foreground mt-3 max-w-[60ch]">
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

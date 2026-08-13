import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { LucideIcon } from 'lucide-react';
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
  /** Action buttons rendered on the right */
  actions?: PageHeaderAction[];
  /** Optional extra content rendered below the header */
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, children, className }: PageHeaderProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {/* Title row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold font-display text-foreground dark:text-white tracking-tight">
            {title}
          </h1>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>

        {/* Actions */}
        {actions && actions.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            {actions.map((action, i) => {
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

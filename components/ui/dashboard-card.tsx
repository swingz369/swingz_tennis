import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconBox } from '@/components/ui/icon-box';

interface DashboardCardProps {
  /** Card title */
  title: string;
  /** Icon displayed next to the title */
  icon?: LucideIcon;
  /** Icon variant for the IconBox */
  iconVariant?:
    | 'primary'
    | 'light'
    | 'blue'
    | 'green'
    | 'amber'
    | 'purple'
    | 'red'
    | 'orange'
    | 'gray';
  /** Optional "View all" or action link */
  action?: {
    label: string;
    href: string;
  };
  /** Card content */
  children: ReactNode;
  className?: string;
  /** Hide default CardHeader padding */
  noHeaderPadding?: boolean;
}

export function DashboardCard({
  title,
  icon,
  iconVariant = 'light',
  action,
  children,
  className,
  noHeaderPadding,
}: DashboardCardProps) {
  return (
    <Card className={cn('border border-border dark:border-white/10 shadow-sm', className)}>
      <CardHeader className={cn('pb-3', noHeaderPadding && 'px-4 pt-4')}>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground dark:text-white">
            {icon && <IconBox icon={icon} size="xs" variant={iconVariant} />}
            {title}
          </CardTitle>
          {action && (
            <Link
              href={action.href}
              className="text-xs font-medium text-brand-light hover:text-brand-primary transition-colors flex items-center gap-0.5"
            >
              {action.label}
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

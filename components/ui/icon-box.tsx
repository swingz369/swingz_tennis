/**
 * IconBox Component
 *
 * Reusable icon container for the repeated pattern:
 * <div className="flex h-X w-X items-center justify-center rounded-xl bg-Y">
 *   <Icon className="h-Z w-Z text-Color" />
 * </div>
 *
 * Used ~30+ times across the codebase — now unified into one component.
 */

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type IconBoxSize = 'xs' | 'sm' | 'md' | 'lg';
export type IconBoxVariant =
  | 'primary'
  | 'light'
  | 'blue'
  | 'green'
  | 'amber'
  | 'purple'
  | 'red'
  | 'orange'
  | 'teal'
  | 'rose'
  | 'indigo'
  | 'gray'
  | 'gradient-primary'
  | 'gradient-accent';

export interface IconBoxProps {
  /** Lucide icon component */
  icon: LucideIcon;
  /** Predefined size. Default: 'md' (h-10 w-10) */
  size?: IconBoxSize;
  /** Color variant. Default: 'light' */
  variant?: IconBoxVariant;
  /** Additional classes for the container div */
  className?: string;
  /** Additional classes for the icon element */
  iconClassName?: string;
}

const sizeClasses: Record<IconBoxSize, { container: string; icon: string }> = {
  xs: {
    container: 'h-7 w-7 rounded-lg',
    icon: 'h-3.5 w-3.5',
  },
  sm: {
    container: 'h-8 w-8 rounded-lg',
    icon: 'h-4 w-4',
  },
  md: {
    container: 'h-10 w-10 rounded-xl',
    icon: 'h-5 w-5',
  },
  lg: {
    container: 'h-14 w-14 rounded-2xl',
    icon: 'h-7 w-7',
  },
};

const variantClasses: Record<IconBoxVariant, string> = {
  primary: 'bg-brand-primary/10 text-brand-primary dark:text-brand-light',
  light: 'bg-brand-light/10 text-brand-light',
  blue: 'bg-info-50 dark:bg-info-900/30 text-info-600 dark:text-info-400',
  green: 'bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400',
  amber: 'bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-400',
  purple: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  red: 'bg-error-50 dark:bg-error-900/20 text-error-500 dark:text-error-400',
  orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
  teal: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400',
  rose: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400',
  indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
  gray: 'bg-muted dark:bg-card/5 text-muted-foreground/50 dark:text-muted-foreground',
  'gradient-primary': 'bg-gradient-to-br from-brand-primary to-brand-light text-white shadow-lg',
  'gradient-accent': 'bg-gradient-accent text-white shadow-lg',
};

export function IconBox({
  icon: Icon,
  size = 'md',
  variant = 'light',
  className,
  iconClassName,
}: IconBoxProps) {
  const sizes = sizeClasses[size];
  const variantClass = variantClasses[variant];

  return (
    <div
      className={cn(
        'flex items-center justify-center shrink-0',
        sizes.container,
        variantClass,
        className
      )}
    >
      <Icon className={cn(sizes.icon, iconClassName)} aria-hidden="true" />
    </div>
  );
}

'use client';

import { cn } from '@/lib/utils';

interface NavigationBadgeProps {
  count: number;
  variant?: 'default' | 'warning' | 'danger';
  className?: string;
}

export function NavigationBadge({ count, variant = 'default', className }: NavigationBadgeProps) {
  if (count === 0) return null;

  const displayCount = count > 99 ? '99+' : count.toString();

  const variantStyles = {
    default: 'bg-brand-light text-white',
    warning: 'bg-amber-500 text-white',
    danger: 'bg-red-500 text-white',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-semibold',
        variantStyles[variant],
        className
      )}
      aria-label={`${count} ungelesene Elemente`}
    >
      {displayCount}
    </span>
  );
}

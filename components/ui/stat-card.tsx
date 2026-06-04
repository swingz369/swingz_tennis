'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

/**
 * StatCard — Reusable KPI card component
 *
 * Inspired by TSOWAPP's StatCard pattern.
 * Used across admin dashboards for consistent stat display.
 *
 * @example
 * <StatCard
 *   icon={Users}
 *   label="Aktive Mitglieder"
 *   value="42"
 *   sub="aktive Mitglieder"
 *   color="blue"
 *   href="/admin/members"
 * />
 */

type StatColor = 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'gray';

const COLOR_MAP: Record<StatColor, { text: string; bg: string; border: string }> = {
  blue: {
    text: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    border: 'hover:border-blue-200 dark:hover:border-blue-700/50',
  },
  green: {
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/30',
    border: 'hover:border-emerald-200 dark:hover:border-emerald-700/50',
  },
  purple: {
    text: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-900/30',
    border: 'hover:border-purple-200 dark:hover:border-purple-700/50',
  },
  orange: {
    text: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'hover:border-orange-200 dark:hover:border-orange-700/50',
  },
  red: {
    text: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'hover:border-red-200 dark:hover:border-red-700/50',
  },
  gray: {
    text: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-50 dark:bg-white/5',
    border: 'hover:border-gray-200 dark:hover:border-white/10',
  },
};

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  /** Alias for sub — used by existing components */
  sublabel?: string;
  color?: StatColor;
  href?: string;
  /** Extra class for the icon container */
  iconClassName?: string;
  /** Extra class for the value text */
  valueClassName?: string;
  className?: string;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  sublabel,
  color = 'blue',
  href,
  iconClassName,
  valueClassName,
  className,
}: StatCardProps) {
  const colors = COLOR_MAP[color];

  const content = (
    <div
      className={cn(
        'border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all cursor-pointer group p-0',
        className
      )}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {label}
            </p>
            <p
              className={cn(
                'text-2xl font-bold text-brand-primary mt-1.5 tabular-nums',
                valueClassName
              )}
            >
              {value}
            </p>
            {(sub || sublabel) && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub || sublabel}</p>
            )}
          </div>
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl shrink-0',
              colors.bg,
              'group-hover:scale-105 transition-transform',
              iconClassName
            )}
          >
            <Icon className={cn('h-5 w-5', colors.text)} />
          </div>
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

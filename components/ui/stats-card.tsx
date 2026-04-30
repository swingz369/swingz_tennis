import * as React from 'react';
import { cn } from '@/lib/utils';

interface StatsCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const StatsCard = React.forwardRef<HTMLDivElement, StatsCardProps>(
  ({ className, label, value, icon, trend, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('rounded-2xl bg-white p-6 shadow-soft border border-gray-100', className)}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            {trend && (
              <div className="flex items-center gap-1 text-sm">
                <span
                  className={cn(
                    'font-semibold',
                    trend.isPositive ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {trend.isPositive ? '+' : ''}
                  {trend.value}%
                </span>
                <span className="text-gray-400">vs letzter Monat</span>
              </div>
            )}
          </div>
          {icon && (
            <div className="rounded-xl bg-brandPrimary/10 p-3 text-brandPrimary">{icon}</div>
          )}
        </div>
      </div>
    );
  }
);
StatsCard.displayName = 'StatsCard';

export { StatsCard };

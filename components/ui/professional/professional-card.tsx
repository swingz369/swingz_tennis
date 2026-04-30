import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva(
  // Base: clean, elevated card with subtle border
  'rounded-2xl bg-white transition-all duration-300 ease-out will-change-transform',
  {
    variants: {
      variant: {
        // Default – elevated with soft shadow, auf/mab beweglich
        default: 'border border-gray-100 shadow-md hover:shadow-lg hover:-translate-y-1',
        // Elevated – mehr Tiefe
        elevated:
          'border border-gray-100 shadow-lg hover:shadow-[0_12px_24px_-4px_rgba(27,67,50,0.12)] hover:-translate-y-2',
        // Bordered – minimal, für Inhalte in Light-Backgrounds
        bordered:
          'border-2 border-gray-200 hover:border-[#1B4332]/40 hover:shadow-[0_8px_24px_-4px_rgba(27,67,50,0.2)]',
        // Flat – für Hintergründe/akzentuiert
        flat: 'bg-gray-50 border border-gray-100',
        // Gradient – Hero-Sektionen
        gradient:
          'bg-gradient-to-br from-white via-gray-50 to-white border border-gray-200 shadow-soft hover:shadow-[0_12px_24px_-4px_rgba(27,67,50,0.2)] hover:-translate-y-1',
      },
      padding: {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
        xl: 'p-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'md',
    },
  }
);

export interface ProfessionalCardProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

const ProfessionalCard = React.forwardRef<HTMLDivElement, ProfessionalCardProps>(
  ({ className, variant, padding, header, footer, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn(cardVariants({ variant, padding }), className)} {...props}>
        {header && <div className="border-b border-gray-100 px-6 py-4">{header}</div>}
        <div className={cn(header && 'pt-0', footer && 'pb-0')}>{children}</div>
        {footer && <div className="border-t border-gray-100 px-6 py-4">{footer}</div>}
      </div>
    );
  }
);
ProfessionalCard.displayName = 'ProfessionalCard';

// Feature Card – specialized for landing pages
interface FeatureCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: boolean;
}

const FeatureCard = React.forwardRef<HTMLDivElement, FeatureCardProps>(
  ({ className, icon, title, description, highlight, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'group relative rounded-2xl bg-white p-8 shadow-soft transition-all duration-300',
          'hover:shadow-[0_12px_40px_-8px_rgba(27,67,50,0.3)] hover:-translate-y-1',
          highlight && 'border-2 border-brandPrimary/20',
          className
        )}
        {...props}
      >
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-brandPrimary/10 text-brandPrimary transition-transform group-hover:scale-110">
          {icon}
        </div>
        <h3 className="mb-2 text-xl font-bold text-gray-900">{title}</h3>
        <p className="text-gray-600 leading-relaxed">{description}</p>
      </div>
    );
  }
);
FeatureCard.displayName = 'FeatureCard';

// Stats Card – for dashboard numbers
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

export { ProfessionalCard, FeatureCard, StatsCard };
export { cardVariants };

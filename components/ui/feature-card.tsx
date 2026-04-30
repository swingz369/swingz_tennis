import * as React from 'react';
import { cn } from '@/lib/utils';

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

export { FeatureCard };

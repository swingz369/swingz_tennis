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
          'group relative rounded-2xl bg-background p-8 shadow-soft transition-all duration-300',
          'hover:shadow-[0_12px_40px_-8px_hsl(var(--brand-primary)/0.3)] hover:-translate-y-1',
          highlight && 'border-2 border-brand-primary/20',
          className
        )}
        {...props}
      >
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary transition-transform group-hover:scale-110">
          {icon}
        </div>
        <h3 className="mb-2 text-xl font-bold text-foreground">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
      </div>
    );
  }
);
FeatureCard.displayName = 'FeatureCard';

export { FeatureCard };

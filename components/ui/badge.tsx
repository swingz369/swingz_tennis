import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-brand-primary/10 text-brand-primary border-brand-primary/20',
        secondary: 'bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20',
        accent: 'bg-brand-accent/10 text-brand-accent border-brand-accent/20',
        success: 'bg-success-100 text-success-700 border-success-200',
        warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        error: 'bg-error-100 text-error-700 border-error-200',
        info: 'bg-info-100 text-info-700 border-info-200',
        outline: 'bg-transparent border-border text-foreground',
      },
      size: {
        sm: 'px-2 py-0.5 text-2xs',
        md: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

Badge.displayName = 'Badge';

export { Badge, badgeVariants };

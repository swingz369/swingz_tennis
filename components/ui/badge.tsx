import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// ── Badges (18.08.2026) ──
// Vorher trug jedes Badge drei Farbschichten: getönte Fläche, getönter Rand,
// farbiger Text. Der Rand ist die überflüssige — er verdoppelt nur die Kante,
// die die Fläche ohnehin bildet, und lässt das Badge wie einen Aufkleber
// wirken. Nur `outline` behält ihn, dort ist er das ganze Element.
const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary',
        secondary: 'bg-brand-secondary/10 text-brand-secondary',
        accent: 'bg-brand-accent/10 text-brand-accent',
        success: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
        warning: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
        error: 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-300',
        info: 'bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-300',
        outline: 'bg-transparent border border-border text-foreground',
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

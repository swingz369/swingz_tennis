import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * ── Karten stehen still (18.08.2026) ──
 *
 * Vorher hob sich **jede** Karte beim Überfahren um 4 px an und warf einen
 * xl-Schatten — auch die, die man gar nicht anklicken kann. Eine Fläche, die
 * auf Mauskontakt reagiert, verspricht eine Aktion; hielt sie nicht, wirkte
 * die Seite unruhig und beliebig. Dazu `duration-500`: eine halbe Sekunde für
 * einen Hover ist doppelt so lang wie die Wahrnehmungsschwelle.
 *
 * Jetzt: Karten sind ruhige Flächen mit Haarlinie, ohne Schatten, ohne
 * Bewegung. Wer eine anklickbare Karte baut, nimmt `variant="interactive"` —
 * dann und nur dann gibt es eine Reaktion, und die ist eine Randfärbung,
 * kein Sprung.
 */
// Karten mit CardHeader/CardContent tragen den Abstand in den Abschnitten —
// sonst addierte sich das Karten-Padding dazu (doppelter Rand, 40 px).
const cardVariants = cva('rounded-xl bg-card [&:has(>div>.card-section)]:p-0', {
  variants: {
    variant: {
      default: 'border border-border',
      interactive: 'border border-border transition-colors duration-150 hover:border-foreground/30',
      elevated: 'border border-border shadow-md',
      bordered: 'border border-input',
      flat: 'bg-muted border border-border',
    },
    padding: {
      none: '',
      sm: 'p-3',
      md: 'p-5',
      lg: 'p-6',
      xl: 'p-8',
    },
  },
  defaultVariants: {
    variant: 'default',
    padding: 'md',
  },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, header, footer, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn(cardVariants({ variant, padding }), className)} {...props}>
        {header && <div className="border-b border-border px-5 py-4">{header}</div>}
        <div className={cn(header && 'pt-0', footer && 'pb-0')}>{children}</div>
        {footer && <div className="border-t border-border px-5 py-4">{footer}</div>}
      </div>
    );
  }
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('card-section flex flex-col space-y-1.5 px-5 py-5', className)}
      {...props}
    />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        'text-lg font-semibold leading-tight tracking-[-0.02em] text-foreground',
        className
      )}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('card-section px-5 pb-5 pt-5 [.card-section+&]:pt-0', className)}
      {...props}
    />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'card-section flex items-center px-5 pb-5 pt-5 [.card-section+&]:pt-0',
        className
      )}
      {...props}
    />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants };

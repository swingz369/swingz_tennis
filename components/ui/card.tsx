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
const cardVariants = cva('rounded-xl bg-card dark:bg-card', {
  variants: {
    variant: {
      default: 'border border-border dark:border-white/10',
      interactive:
        'border border-border dark:border-white/10 transition-colors duration-150 hover:border-foreground/25 dark:hover:border-white/25',
      elevated: 'border border-border dark:border-white/10 shadow-md',
      bordered: 'border border-border dark:border-white/20',
      flat: 'bg-muted dark:bg-card/5 border border-border dark:border-white/10',
    },
    padding: {
      none: '',
      sm: 'p-3',
      md: 'p-4',
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
        {header && (
          <div className="border-b border-border dark:border-white/10 px-4 py-3">{header}</div>
        )}
        <div className={cn(header && 'pt-0', footer && 'pb-0')}>{children}</div>
        {footer && (
          <div className="border-t border-border dark:border-white/10 px-4 py-3">{footer}</div>
        )}
      </div>
    );
  }
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 px-4 py-4', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        'text-lg font-semibold leading-none tracking-tight text-foreground dark:text-white',
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
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground dark:text-muted-foreground', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-4 pb-4 pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center px-4 pb-4 pt-0', className)} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants };

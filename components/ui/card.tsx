import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva(
  'rounded-2xl bg-background dark:bg-surface-dark transition-all duration-500 ease-out',
  {
    variants: {
      variant: {
        default:
          'border border-border dark:border-white/10 shadow-sm hover:shadow-xl hover:-translate-y-1',
        elevated:
          'border border-border dark:border-white/10 shadow-lg hover:shadow-2xl hover:-translate-y-2',
        bordered:
          'border-2 border-border dark:border-white/20 hover:border-brand-light/50 hover:shadow-xl',
        flat: 'bg-muted dark:bg-card/5 border border-border dark:border-white/10',
        gradient:
          'bg-gradient-to-br from-white via-gray-50/50 to-white dark:from-surface-dark dark:via-brand-primary/20 dark:to-surface-dark border border-border dark:border-white/10 shadow-lg hover:shadow-2xl hover:-translate-y-1',
        glass:
          'bg-background/80 dark:bg-card/5 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-xl',
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
          <div className="border-b border-border dark:border-white/10 px-6 py-4">{header}</div>
        )}
        <div className={cn(header && 'pt-0', footer && 'pb-0')}>{children}</div>
        {footer && (
          <div className="border-t border-border dark:border-white/10 px-6 py-4">{footer}</div>
        )}
      </div>
    );
  }
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    /* eslint-disable-next-line jsx-a11y/heading-has-content -- children passed via props spread */
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
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants };

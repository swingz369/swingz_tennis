import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva(
  'rounded-2xl bg-white shadow-sm transition-all duration-300 ease-out border',
  {
    variants: {
      variant: {
        default: 'border-gray-100 shadow-md hover:shadow-lg hover:-translate-y-1',
        elevated:
          'border-gray-100 shadow-lg hover:shadow-[0_12px_24px_-4px_rgba(27,67,50,0.12)] hover:-translate-y-2',
        bordered:
          'border-2 border-gray-200 hover:border-[#1B4332]/40 hover:shadow-[0_8px_24px_-4px_rgba(27,67,50,0.2)]',
        flat: 'bg-gray-50 border border-gray-100',
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

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
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
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('font-semibold leading-none tracking-tight', className)}
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

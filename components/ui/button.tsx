import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-primary text-white shadow-md hover:shadow-lg hover:brightness-105 focus-visible:ring-brand-light/50',
        primary:
          'bg-gradient-primary text-white shadow-lg hover:shadow-xl hover:brightness-110 focus-visible:ring-brand-light/50',
        secondary:
          'bg-brand-secondary text-white shadow-md hover:bg-brand-secondary/90 hover:shadow-lg focus-visible:ring-brand-secondary/50',
        outline:
          'border-2 border-gray-200 dark:border-white/20 bg-transparent text-gray-700 dark:text-white hover:border-brand-light hover:text-brand-light hover:bg-brand-light/5 focus-visible:ring-brand-light/50',
        ghost:
          'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white focus-visible:ring-gray-300',
        destructive:
          'bg-red-600 text-white shadow-md hover:bg-red-700 hover:shadow-lg focus-visible:ring-red-500',
        accent:
          'bg-gradient-accent text-white shadow-lg hover:shadow-xl focus-visible:ring-brand-accent/50',
        gradient:
          'bg-gradient-to-r from-brand-primary via-brand-primary/80 to-brand-light text-white shadow-lg hover:shadow-xl focus-visible:ring-brand-light/50',
        link: 'text-brand-light underline-offset-4 hover:underline',
        brand:
          'bg-brand-light hover:bg-brand-light/80 text-white shadow-md hover:shadow-lg focus-visible:ring-brand-light/50',
      },
      size: {
        sm: 'h-9 px-4 text-sm gap-1.5',
        md: 'h-11 px-5 text-base gap-2',
        lg: 'h-12 px-6 text-lg gap-2.5',
        xl: 'h-14 px-8 text-xl gap-3',
        default: 'h-10 px-4 py-2',
        icon: 'h-10 w-10 p-0',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  'aria-label'?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      asChild = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';

    const hasTextContent =
      React.Children.count(children) > 0 &&
      React.Children.toArray(children).some(
        (child) => typeof child === 'string' || typeof child === 'number'
      );

    const computedAriaLabel = ariaLabel || (!hasTextContent ? 'Button' : undefined);

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        aria-label={computedAriaLabel}
        aria-busy={isLoading}
        {...props}
      >
        {asChild ? (
          children
        ) : isLoading ? (
          <>
            <svg
              className="mr-2 h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {children}
          </>
        ) : (
          <>
            {leftIcon && (
              <span className="flex items-center" aria-hidden="true">
                {leftIcon}
              </span>
            )}
            {children}
            {rightIcon && (
              <span className="flex items-center" aria-hidden="true">
                {rightIcon}
              </span>
            )}
          </>
        )}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };

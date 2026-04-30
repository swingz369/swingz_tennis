import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-full font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: [
          'bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] text-white',
          'focus-visible:ring-[#1B4332]',
        ],
        secondary: [
          'bg-[#1e3a5f] text-white',
          'focus-visible:ring-[#1e3a5f]',
        ],
        outline: [
          'border-2 border-[#1B4332]/30 bg-transparent text-[#1B4332]',
          'hover:border-[#1B4332]/60 hover:bg-[#1B4332]/5',
          'focus-visible:ring-[#1B4332]/20',
        ],
        ghost: [
          'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
          'hover:shadow-sm',
          'focus-visible:ring-gray-200',
        ],
        destructive: [
          'bg-red-600 text-white shadow-sm hover:bg-red-700',
          'focus-visible:ring-red-500',
        ],
        accent: [
          'bg-gradient-to-r from-[#FF6B35] to-[#FF8C5A] text-white',
          'focus-visible:ring-[#FF6B35]',
        ],
        gradient: [
          'bg-gradient-to-r from-[#1B4332] via-[#2D6A4F] to-[#FF6B35] text-white',
          'focus-visible:ring-[#1B4332]',
        ],
      },
      size: {
        sm: 'h-9 px-3 text-sm gap-1.5',
        md: 'h-11 px-5 text-base gap-2',
        lg: 'h-14 px-7 text-lg gap-2.5',
        xl: 'h-16 px-8 text-xl gap-3',
        icon: 'h-10 w-10 p-0',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ProfessionalButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const ProfessionalButton = React.forwardRef<HTMLButtonElement, ProfessionalButtonProps>(
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
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, fullWidth }),
          isLoading && 'cursor-not-allowed opacity-70',
          className
        )}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
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
        ) : leftIcon ? (
          <span className="flex items-center gap-2">{leftIcon}</span>
        ) : null}
        {children}
        {!isLoading && rightIcon && <span className="flex items-center gap-2">{rightIcon}</span>}
      </Comp>
    );
  }
);
ProfessionalButton.displayName = 'ProfessionalButton';

export { ProfessionalButton, buttonVariants };

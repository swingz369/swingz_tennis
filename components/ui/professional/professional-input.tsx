import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const inputVariants = cva(
  'flex w-full rounded-xl border bg-white px-4 py-3 text-base shadow-sm transition-all duration-200',
  {
    variants: {
      variant: {
        default:
          'border-gray-200 focus:border-brandPrimary focus:ring-2 focus:ring-brandPrimary/20',
        filled:
          'border-0 border-b-2 border-gray-200 bg-gray-50 rounded-none px-0 focus:border-brandPrimary focus:ring-0',
        underlined:
          'border-0 border-b-2 border-gray-200 rounded-none px-0 focus:border-brandPrimary',
        search: 'pl-10 pr-4 py-2.5',
      },
      size: {
        sm: 'h-9 text-sm px-3',
        md: 'h-11 px-4',
        lg: 'h-14 px-5 text-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface ProfessionalInputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: string;
}

const ProfessionalInput = React.forwardRef<HTMLInputElement, ProfessionalInputProps>(
  ({ className, variant, size, error, leftIcon, rightIcon, type, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{leftIcon}</div>
        )}
        <input
          type={type}
          className={cn(
            inputVariants({ variant, size }),
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
            className
          )}
          ref={ref}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{rightIcon}</div>
        )}
        {error && <div className="absolute -bottom-6 left-0 text-sm text-red-600">{error}</div>}
      </div>
    );
  }
);
ProfessionalInput.displayName = 'ProfessionalInput';

// Textarea Variant
const textareaVariants = cva(
  'flex w-full rounded-xl border bg-white px-4 py-3 text-base shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandPrimary/20 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      size: {
        sm: 'min-h-[80px] text-sm p-3',
        md: 'min-h-[120px]',
        lg: 'min-h-[160px] text-lg p-4',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

export interface ProfessionalTextareaProps
  extends
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    Omit<VariantProps<typeof textareaVariants>, 'error'> {
  error?: string;
}

const ProfessionalTextarea = React.forwardRef<HTMLTextAreaElement, ProfessionalTextareaProps>(
  ({ className, size, error, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <textarea
          className={cn(
            textareaVariants({ size }),
            error && 'border-red-500 focus:border-red-500',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <div className="mt-1 text-sm text-red-600">{error}</div>}
      </div>
    );
  }
);
ProfessionalTextarea.displayName = 'ProfessionalTextarea';

export { ProfessionalInput, ProfessionalTextarea };
export { inputVariants };

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const textareaVariants = cva(
  'flex w-full rounded-xl border bg-background px-4 py-3 text-base shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandPrimary/20 disabled:cursor-not-allowed disabled:opacity-50',
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

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, VariantProps<typeof textareaVariants> {
  error?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
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
Textarea.displayName = 'Textarea';

export { Textarea, textareaVariants };

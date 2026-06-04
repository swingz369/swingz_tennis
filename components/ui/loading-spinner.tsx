import { cn } from '@/lib/utils';

/**
 * LoadingSpinner — Branded loading spinner with SwingZ colors.
 *
 * Replaces the generic Loader2 spinner with a brand-aware alternative.
 * Supports multiple sizes and optional text.
 *
 * @example
 * <LoadingSpinner />
 * <LoadingSpinner size="lg" text="Wird geladen..." />
 * <LoadingSpinner variant="page" />
 */

interface LoadingSpinnerProps {
  /** Spinner size */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Optional loading text below spinner */
  text?: string;
  /** Variant: inline (default) or full-page overlay */
  variant?: 'inline' | 'page';
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-3',
  xl: 'h-16 w-16 border-4',
};

const textSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
};

export function LoadingSpinner({
  size = 'md',
  text,
  variant = 'inline',
  className,
}: LoadingSpinnerProps) {
  const spinner = (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div
        className={cn(
          'rounded-full animate-spin',
          sizeClasses[size],
          'border-brand-light/20 border-t-brand-light',
          'dark:border-brand-light/10 dark:border-t-brand-light'
        )}
      />
      {text && (
        <p className={cn('text-muted-foreground animate-pulse', textSizeClasses[size])}>{text}</p>
      )}
    </div>
  );

  if (variant === 'page') {
    return <div className="flex items-center justify-center min-h-[50vh]">{spinner}</div>;
  }

  return spinner;
}

/**
 * PageLoader — Full-page loading overlay with brand spinner
 */
export function PageLoader({ text = 'Wird geladen...' }: { text?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <LoadingSpinner size="xl" text={text} />
    </div>
  );
}

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
 * PageLoading — Standard-Fallback für `loading.tsx` beim Seitenwechsel.
 *
 * Indeterminierter Balken in den Markenfarben statt eines nackten Spinners.
 * Nutzt die bestehende `shimmer`-Animation aus app/globals.css; die globale
 * `prefers-reduced-motion`-Regel dort schaltet sie automatisch ab.
 *
 * @example
 * // app/(protected)/irgendwas/loading.tsx
 * export { PageLoading as default } from '@/components/ui/loading-spinner';
 */
export function PageLoading({ text = 'Wird geladen…' }: { text?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6"
    >
      <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
        <div className="animate-shimmer h-full w-full rounded-full bg-[linear-gradient(90deg,transparent_0%,hsl(var(--brand-primary))_35%,hsl(var(--brand-primary-light))_65%,transparent_100%)] bg-[length:200%_100%]" />
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
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

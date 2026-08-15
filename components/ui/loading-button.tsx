/**
 * Loading Button Component
 *
 * Button with integrated loading state and spinner
 */

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { createLogger } from '@/lib/logger';

const log = createLogger('ui:loading-button');

export interface LoadingButtonProps extends ButtonProps {
  /**
   * Whether the button is in loading state
   */
  loading?: boolean;

  /**
   * Text to display when loading (optional, defaults to children)
   */
  loadingText?: string;

  /**
   * Custom loading icon (optional, defaults to Loader2)
   */
  loadingIcon?: React.ReactNode;

  /**
   * Position of the loading spinner
   */
  spinnerPosition?: 'left' | 'right';
}

export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    {
      children,
      loading = false,
      loadingText,
      loadingIcon,
      spinnerPosition = 'left',
      disabled,
      className,
      ...props
    },
    ref
  ) => {
    const spinner = loadingIcon || <Loader2 className="h-4 w-4 animate-spin" />;
    const displayText = loading && loadingText ? loadingText : children;

    return (
      <Button
        ref={ref}
        disabled={loading || disabled}
        className={cn(loading && 'cursor-not-allowed', className)}
        {...props}
      >
        {loading && spinnerPosition === 'left' && <span className="mr-2">{spinner}</span>}
        {displayText}
        {loading && spinnerPosition === 'right' && <span className="ml-2">{spinner}</span>}
      </Button>
    );
  }
);

LoadingButton.displayName = 'LoadingButton';

/**
 * Hook for managing button loading state
 */
export function useLoadingButton() {
  const [isLoading, setIsLoading] = React.useState(false);

  /**
   * Execute an async function while managing loading state
   */
  const execute = React.useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      setIsLoading(true);
      const result = await fn();
      return result;
    } catch (error) {
      log.error('Error in loading button:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    setIsLoading,
    execute,
  };
}

/**
 * Helper hook for form submissions with loading state
 */
export function useFormSubmit<T = any>(
  onSubmit: (data: T) => Promise<void>,
  options?: {
    onSuccess?: () => void;
    onError?: (error: unknown) => void;
  }
) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = React.useCallback(
    async (data: T) => {
      try {
        setIsSubmitting(true);
        setError(null);
        await onSubmit(data);
        options?.onSuccess?.();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten';
        setError(errorMessage);
        options?.onError?.(err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSubmit, options]
  );

  return {
    isSubmitting,
    error,
    handleSubmit,
  };
}

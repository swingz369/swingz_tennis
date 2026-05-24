/**
 * Error Boundary Component
 *
 * Catches React errors in component tree and displays fallback UI
 */

'use client';

import * as React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /**
   * Custom fallback component
   */
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  /**
   * Callback when error occurs
   */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /**
   * Whether to show error details (default: false in production)
   */
  showDetails?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Class Component
 * (Must be class component as React doesn't support error boundaries in function components yet)
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error Boundary caught error:', error, errorInfo);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Log to error tracking service (Sentry, etc.)
    // if (process.env.NODE_ENV === 'production') {
    //   reportErrorToService(error, errorInfo);
    // }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      // Default fallback UI
      return (
        <DefaultErrorFallback
          error={this.state.error}
          resetError={this.resetError}
          showDetails={this.props.showDetails ?? process.env.NODE_ENV !== 'production'}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Default Error Fallback UI
 */
function DefaultErrorFallback({
  error,
  resetError,
  showDetails = false,
}: {
  error: Error;
  resetError: () => void;
  showDetails?: boolean;
}) {
  const handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
        </div>

        <h2 className="mb-2 text-2xl font-bold">Etwas ist schiefgelaufen</h2>

        <p className="mb-6 text-muted-foreground">
          Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut oder kehre zur
          Startseite zurück.
        </p>

        {showDetails && (
          <details className="mb-6 rounded-lg bg-muted p-4 text-left">
            <summary className="cursor-pointer font-semibold text-sm">
              Fehlerdetails anzeigen
            </summary>
            <div className="mt-3 space-y-2">
              <div>
                <p className="font-mono text-xs text-destructive">{error.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{error.message}</p>
              </div>
              {error.stack && (
                <pre className="overflow-x-auto text-xs text-muted-foreground">{error.stack}</pre>
              )}
            </div>
          </details>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={resetError} variant="default" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Erneut versuchen
          </Button>

          <Button onClick={handleGoHome} variant="outline" className="gap-2">
            <Home className="h-4 w-4" />
            Zur Startseite
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact Error Fallback for smaller areas
 */
export function CompactErrorFallback({
  error,
  resetError,
}: {
  error: Error;
  resetError: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <AlertTriangle className="mb-3 h-8 w-8 text-destructive" />
      <p className="mb-3 text-sm text-muted-foreground">
        {error.message || 'Ein Fehler ist aufgetreten'}
      </p>
      <Button onClick={resetError} size="sm" variant="outline">
        Erneut versuchen
      </Button>
    </div>
  );
}

/**
 * Hook for using error boundaries programmatically
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return setError;
}

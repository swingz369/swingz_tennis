/**
 * Error Boundary Component
 *
 * Catches React errors in component tree and displays fallback UI
 */

'use client';

import * as React from 'react';
import { AlertTriangle, RefreshCw, Home, Mail, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createLogger } from '@/lib/logger';

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
    // Use structured logger which reports to Sentry in production
    const log = createLogger('error-boundary');
    log.error('Error Boundary caught error', error);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
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
  const [copied, setCopied] = React.useState(false);

  const handleGoHome = () => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- harter Reload gewollt: Fehlerzustand des React-Baums verwerfen
    window.location.href = '/dashboard';
  };

  const handleCopyDetails = async () => {
    const details = `${error.name}: ${error.message}\n${error.stack ?? ''}`;
    try {
      await navigator.clipboard.writeText(details);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — user can manually copy from details above
    }
  };

  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center p-8"
      role="alert"
      aria-live="assertive"
    >
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertTriangle className="h-12 w-12 text-destructive" aria-hidden="true" />
          </div>
        </div>

        <h2 className="mb-2 text-2xl font-semibold">Etwas ist schiefgelaufen</h2>

        <p className="mb-6 text-muted-foreground">
          Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut oder kehre zur
          Startseite zurück.
        </p>

        {showDetails && (
          <details className="mb-6 rounded-xl bg-muted p-4 text-left">
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

          {showDetails && (
            <Button onClick={handleCopyDetails} variant="ghost" size="sm" className="gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Kopiert' : 'Details kopieren'}
            </Button>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">
            Falls das Problem bestehen bleibt, kontaktiere uns bitte:
          </p>
          <a
            href="mailto:support@swingz.cloud?subject=Fehler%20in%20SWINGZ"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-brand-light transition-colors font-medium"
          >
            <Mail className="h-3.5 w-3.5" />
            support@swingz.cloud
          </a>
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

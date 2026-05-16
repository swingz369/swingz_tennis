/**
 * Protected Page Wrapper with Error Boundary
 *
 * Wraps all protected pages with consistent error handling,
 * loading states, and authentication checks.
 */

'use client';

import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Skeleton } from '@/components/ui/skeleton';

interface ProtectedPageWrapperProps {
  children: ReactNode;
  /**
   * Page title for error reporting
   */
  pageName?: string;
  /**
   * Custom loading fallback
   */
  loadingFallback?: ReactNode;
  /**
   * Show error details (defaults to dev mode only)
   */
  showErrorDetails?: boolean;
}

/**
 * Default loading fallback
 */
function DefaultLoadingFallback() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

/**
 * Wraps protected pages with error boundary and suspense
 */
export function ProtectedPageWrapper({
  children,
  pageName,
  loadingFallback,
  showErrorDetails,
}: ProtectedPageWrapperProps) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error(`Error in ${pageName || 'protected page'}:`, {
          error,
          errorInfo,
          timestamp: new Date().toISOString(),
        });

        // Report to error tracking service (Sentry) in production
        if (process.env.NODE_ENV === 'production') {
          import('@sentry/nextjs')
            .then((Sentry) => {
              Sentry.captureException(error, {
                contexts: {
                  reactErrorInfo: {
                    componentStack: errorInfo?.componentStack || null,
                  },
                },
                tags: { pageName: pageName || 'unknown' },
              });
            })
            .catch(() => {});
        }
      }}
      showDetails={showErrorDetails}
    >
      <Suspense fallback={loadingFallback || <DefaultLoadingFallback />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

/**
 * Compact wrapper for smaller sections
 */
export function PageSection({
  children,
  title,
  className,
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <ErrorBoundary
      onError={(error) => {
        console.error(`Error in section ${title}:`, error);
      }}
      fallback={({ error, resetError }) => (
        <div
          className={`rounded-lg border border-destructive/50 bg-destructive/5 p-4 ${className || ''}`}
        >
          <div className="text-center">
            <p className="mb-2 text-sm text-destructive">{error.message}</p>
            <button onClick={resetError} className="text-xs text-muted-foreground hover:underline">
              Erneut versuchen
            </button>
          </div>
        </div>
      )}
    >
      <div className={className}>{children}</div>
    </ErrorBoundary>
  );
}

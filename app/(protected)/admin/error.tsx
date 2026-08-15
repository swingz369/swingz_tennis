/**
 * Admin Portal Error Boundary
 * Pattern from INTEGRATION_ROADMAP.md Phase 4.1
 *
 * Catches errors in admin portal
 * Provides admin-specific error handling and context
 */

'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Add admin context to Sentry
    Sentry.setContext('portal', {
      type: 'admin',
      path: window.location.pathname,
    });

    Sentry.captureException(error, {
      level: 'error',
      tags: {
        boundary: 'admin',
      },
      extra: {
        digest: error.digest,
        url: window.location.href,
      },
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 dark:bg-background">
      <div className="w-full max-w-lg rounded-xl bg-card p-8 shadow-lg">
        <div className="mb-6 flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="h-12 w-12 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div className="ml-4">
            <h2 className="text-2xl font-bold text-foreground">Admin-Fehler</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Beim Laden der Admin-Oberfläche ist ein Fehler aufgetreten.
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-xl bg-destructive/10 p-4">
          <p className="text-sm font-medium text-destructive">
            {error.message || 'Ein unbekannter Fehler ist aufgetreten.'}
          </p>
          {error.digest && (
            <p className="mt-2 text-xs text-destructive/70">Fehler-ID: {error.digest}</p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={reset}
            className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Erneut versuchen
          </button>

          <button
            onClick={() => router.push('/admin')}
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Zurück zum Dashboard
          </button>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={() => (window.location.href = '/')}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Zur Startseite
          </button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
            <summary className="cursor-pointer text-sm font-medium text-destructive">
              Stack Trace anzeigen
            </summary>
            <pre className="mt-3 overflow-auto text-xs text-destructive">{error.stack}</pre>
          </details>
        )}
      </div>
    </div>
  );
}

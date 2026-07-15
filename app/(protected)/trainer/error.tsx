/**
 * Trainer Portal Error Boundary
 * Pattern from INTEGRATION_ROADMAP.md Phase 4.1
 *
 * Catches errors in trainer portal
 * Provides trainer-specific error handling
 */

'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TrainerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    Sentry.setContext('portal', {
      type: 'trainer',
      path: window.location.pathname,
    });

    Sentry.captureException(error, {
      level: 'error',
      tags: {
        boundary: 'trainer',
      },
      extra: {
        digest: error.digest,
      },
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 dark:bg-background">
      <div className="w-full max-w-lg rounded-xl bg-card p-8 shadow-lg">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">Trainer-Portal Fehler</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Beim Laden des Trainer-Bereichs ist ein Fehler aufgetreten.
          </p>
        </div>

        <div className="mb-6 rounded-xl bg-warning-light border border-warning/20 p-4 dark:bg-warning/10">
          <p className="text-sm text-warning">
            {error.message || 'Ein unbekannter Fehler ist aufgetreten.'}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={reset}
            className="flex-1 rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90"
          >
            Erneut versuchen
          </button>

          <button
            onClick={() => router.push('/trainer')}
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Zum Trainer-Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

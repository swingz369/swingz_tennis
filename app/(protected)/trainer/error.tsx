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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-8 shadow-lg">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Trainer-Portal Fehler</h2>
          <p className="mt-2 text-sm text-gray-600">
            Beim Laden des Trainer-Bereichs ist ein Fehler aufgetreten.
          </p>
        </div>

        <div className="mb-6 rounded-md bg-yellow-50 border border-yellow-200 p-4">
          <p className="text-sm text-yellow-800">
            {error.message || 'Ein unbekannter Fehler ist aufgetreten.'}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={reset}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Erneut versuchen
          </button>

          <button
            onClick={() => router.push('/trainer')}
            className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Zum Trainer-Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

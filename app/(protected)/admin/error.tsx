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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-8 shadow-lg">
        <div className="mb-6 flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="h-12 w-12 text-red-600"
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
            <h2 className="text-2xl font-bold text-gray-900">Admin-Fehler</h2>
            <p className="mt-2 text-sm text-gray-600">
              Beim Laden der Admin-Oberfläche ist ein Fehler aufgetreten.
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-md bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">
            {error.message || 'Ein unbekannter Fehler ist aufgetreten.'}
          </p>
          {error.digest && <p className="mt-2 text-xs text-red-600">Fehler-ID: {error.digest}</p>}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={reset}
            className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Erneut versuchen
          </button>

          <button
            onClick={() => router.push('/admin')}
            className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Zurück zum Dashboard
          </button>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={() => (window.location.href = '/')}
            className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
          >
            Zur Startseite
          </button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 rounded border border-red-200 bg-red-50 p-3">
            <summary className="cursor-pointer text-sm font-medium text-red-800">
              Stack Trace anzeigen
            </summary>
            <pre className="mt-3 overflow-auto text-xs text-red-900">{error.stack}</pre>
          </details>
        )}
      </div>
    </div>
  );
}

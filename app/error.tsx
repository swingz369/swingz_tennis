/**
 * Global Error Boundary
 * Pattern from INTEGRATION_ROADMAP.md Phase 4.1
 *
 * Catches all unhandled errors in the application
 * Sends errors to Sentry for monitoring
 * Shows user-friendly error message
 */

'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Capture error to Sentry
    Sentry.captureException(error, {
      level: 'error',
      tags: {
        boundary: 'global',
      },
      extra: {
        digest: error.digest,
      },
    });
  }, [error]);

  return (
    <html lang="de">
      <body>
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
          <div className="w-full max-w-md text-center">
            <div className="mb-8">
              <svg
                className="mx-auto h-16 w-16 text-red-500"
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

            <h1 className="mb-4 text-4xl font-bold text-gray-900">Etwas ist schiefgelaufen</h1>

            <p className="mb-8 text-lg text-gray-600">
              Ein unerwarteter Fehler ist aufgetreten. Unser Team wurde automatisch benachrichtigt
              und kümmert sich um das Problem.
            </p>

            {error.digest && (
              <p className="mb-8 text-sm text-gray-500">
                Fehler-ID:{' '}
                <code className="rounded bg-gray-100 px-2 py-1 font-mono">{error.digest}</code>
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={reset}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Erneut versuchen
              </button>

              <button
                onClick={() => (window.location.href = '/')}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Zur Startseite
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <details className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-left">
                <summary className="cursor-pointer font-semibold text-red-800">
                  Entwickler-Details anzeigen
                </summary>
                <pre className="mt-4 overflow-auto text-xs text-red-900">
                  {error.message}
                  {'\n\n'}
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}

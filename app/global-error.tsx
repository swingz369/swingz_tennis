/**
 * Global Error Page
 *
 * This file is automatically used by Next.js to catch errors in the app
 */

'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      level: 'error',
      tags: { boundary: 'global-root' },
      extra: { digest: error.digest },
    });
  }, [error]);

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <html lang="de">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
          <div className="mx-auto max-w-md text-center">
            <div className="mb-6 flex justify-center">
              <div className="rounded-full bg-destructive/10 p-4">
                <AlertTriangle className="h-16 w-16 text-destructive" />
              </div>
            </div>

            <h1 className="mb-2 text-3xl font-bold">Etwas ist schiefgelaufen</h1>

            <p className="mb-8 text-muted-foreground">
              Ein kritischer Fehler ist aufgetreten. Bitte lade die Seite neu oder kehre zur
              Startseite zurück.
            </p>

            {process.env.NODE_ENV !== 'production' && (
              <details className="mb-8 rounded-xl bg-muted p-4 text-left">
                <summary className="cursor-pointer font-semibold">Fehlerdetails</summary>
                <div className="mt-3 space-y-2">
                  <p className="font-mono text-xs text-destructive">{error.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{error.message}</p>
                  {error.digest && (
                    <p className="font-mono text-xs text-muted-foreground">
                      Error ID: {error.digest}
                    </p>
                  )}
                  {error.stack && (
                    <pre className="overflow-x-auto text-xs text-muted-foreground">
                      {error.stack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button onClick={reset} size="lg" className="gap-2">
                <RefreshCw className="h-5 w-5" />
                Seite neu laden
              </Button>

              <Button onClick={handleGoHome} size="lg" variant="outline" className="gap-2">
                <Home className="h-5 w-5" />
                Zur Startseite
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

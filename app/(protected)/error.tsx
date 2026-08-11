'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

import { createLogger } from '@/lib/logger';

const log = createLogger('error');

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report to Sentry in production
    if (process.env.NODE_ENV === 'production') {
      import('@sentry/nextjs')
        .then((Sentry) => {
          Sentry.captureException(error);
        })
        .catch(() => {});
    }
    log.error('Protected route error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-gray-100">
            Etwas ist schiefgelaufen
          </h1>
          <p className="text-muted-foreground dark:text-muted-foreground">
            {error.message || 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.'}
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground dark:text-muted-foreground font-mono">
              Fehler-ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset} variant="default" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Erneut versuchen
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/dashboard">
              <Home className="h-4 w-4" />
              Zum Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

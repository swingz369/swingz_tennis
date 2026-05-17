'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PageErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  message?: string;
  dashboardHref?: string;
}

/**
 * Shared error boundary component for protected pages.
 * Use by importing and rendering in error.tsx files.
 *
 * Usage:
 *   export default function MyError({ error, reset }) {
 *     return <PageError error={error} reset={reset} title="... " message="..." />;
 *   }
 */
export function PageError({
  error,
  reset,
  title = 'Fehler beim Laden',
  message = 'Die Seite konnte nicht geladen werden. Bitte versuche es erneut.',
  dashboardHref = '/dashboard',
}: PageErrorProps) {
  const router = useRouter();

  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[600px] items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-red-100 dark:bg-red-900/20">
              <AlertTriangle className="h-10 w-10 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-gray-600 dark:text-gray-400">{error.message || message}</p>

          {error.digest && (
            <p className="text-xs text-center text-gray-400 font-mono">Error ID: {error.digest}</p>
          )}

          <div className="space-y-2 pt-2">
            <Button
              onClick={reset}
              className="w-full flex items-center justify-center gap-2"
              variant="default"
            >
              <RefreshCw className="h-4 w-4" />
              Erneut versuchen
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push(dashboardHref)}
              className="w-full flex items-center justify-center gap-2"
            >
              <Home className="h-4 w-4" />
              Zum Dashboard
            </Button>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4 rounded border border-red-200 bg-red-50 p-3">
              <summary className="cursor-pointer text-sm font-medium text-red-800">
                Fehlerdetails
              </summary>
              <pre className="mt-2 overflow-auto text-xs text-red-900">
                {error.message}
                {'\n\n'}
                {error.stack}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

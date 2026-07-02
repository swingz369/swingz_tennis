'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin analytics error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-error-100 dark:bg-error-900/20">
              <AlertTriangle className="h-8 w-8 text-error-600 dark:text-error-400" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Fehler in der Analysedaten</CardTitle>
          <CardDescription className="text-center">
            {error.message ||
              'Die Analyse-Daten konnten nicht geladen werden. Bitte versuchen Sie es erneut.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={reset} className="w-full">
            Erneut versuchen
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = '/dashboard')}
            className="w-full"
          >
            Zurück zum Dashboard
          </Button>
          {error.digest && (
            <p className="text-xs text-muted-foreground text-center">Fehler-ID: {error.digest}</p>
          )}
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                Fehlerdetails (Entwicklung)
              </summary>
              <pre className="mt-2 p-4 bg-muted rounded text-xs overflow-auto">
                {error.toString()}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

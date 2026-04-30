'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Ein Fehler ist aufgetreten</CardTitle>
          <CardDescription>
            {error.message || 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={reset} className="w-full">
            Erneut versuchen
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = '/')} className="w-full">
            Zur Startseite
          </Button>
          {error.digest && (
            <p className="text-xs text-muted-foreground text-center">Fehler-ID: {error.digest}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
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
    console.error('Protected route error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Fehler im geschützten Bereich</CardTitle>
          <CardDescription>
            {error.message || 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.'}
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
            Zum Dashboard
          </Button>
          {error.digest && (
            <p className="text-xs text-muted-foreground text-center">Fehler-ID: {error.digest}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

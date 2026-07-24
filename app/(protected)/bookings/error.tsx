'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function BookingsError({ error, reset }: ErrorProps) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { page: 'bookings' } });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <h2 className="text-xl font-semibold">Etwas ist schiefgelaufen</h2>
      <p className="text-muted-foreground text-center max-w-md">
        Die Buchungen konnten nicht geladen werden. Bitte versuche es erneut.
      </p>
      {process.env.NODE_ENV === 'development' && (
        <pre className="text-xs text-error-500 bg-error-50 p-2 rounded">{error.message}</pre>
      )}
      <Button onClick={reset}>Erneut versuchen</Button>
    </div>
  );
}

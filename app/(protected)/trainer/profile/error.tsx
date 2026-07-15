'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TrainerProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    Sentry.setContext('portal', { section: 'trainer-profile' });
    Sentry.setTag('portal', 'trainer');
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-lg text-center space-y-4 p-6">
        <div className="mx-auto h-14 w-14 rounded-xl bg-error-50 dark:bg-error-900/20 flex items-center justify-center">
          <XCircle className="h-7 w-7 text-error-400" />
        </div>
        <h2 className="text-lg font-bold text-foreground dark:text-white">
          Profil konnte nicht geladen werden
        </h2>
        <p className="text-sm text-muted-foreground">
          Beim Laden deines Profils ist ein Fehler aufgetreten. Bitte versuche es erneut.
        </p>
        <div className="rounded-xl bg-error-50 dark:bg-error-900/10 border border-error-200 dark:border-error-800 p-3 text-xs text-error-600 dark:text-error-400 break-all">
          {error.message}
        </div>
        <div className="flex gap-3 justify-center pt-2">
          <Button variant="outline" onClick={() => reset()}>
            Erneut versuchen
          </Button>
          <Button variant="primary" onClick={() => router.push('/trainer')}>
            Zurück zum Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

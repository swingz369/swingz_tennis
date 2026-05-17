'use client';

import { PageError } from '@/components/ui/page-error';

export default function AvailabilityError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageError
      error={error}
      reset={reset}
      title="Fehler beim Laden der Verfügbarkeit"
      message="Die Verfügbarkeitsdaten konnten nicht geladen werden."
      dashboardHref="/trainer"
    />
  );
}

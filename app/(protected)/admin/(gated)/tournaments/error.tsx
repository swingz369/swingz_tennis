'use client';

import { PageError } from '@/components/ui/page-error';

export default function TournamentsError({
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
      title="Fehler beim Laden der Turniere"
      message="Die Turnierdaten konnten nicht geladen werden."
    />
  );
}

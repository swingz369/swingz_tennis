'use client';

import { PageError } from '@/components/ui/page-error';

export default function SuperadminClubsError({
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
      title="Fehler beim Laden der Vereine"
      message="Die Vereinsdaten konnten nicht geladen werden."
    />
  );
}

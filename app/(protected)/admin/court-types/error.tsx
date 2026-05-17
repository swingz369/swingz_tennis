'use client';

import { PageError } from '@/components/ui/page-error';

export default function CourtTypesError({
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
      title="Fehler beim Laden der Platztypen"
      message="Die Platztypen konnten nicht geladen werden."
    />
  );
}

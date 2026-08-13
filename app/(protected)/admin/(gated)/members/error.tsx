'use client';

import { PageError } from '@/components/ui/page-error';

export default function MembersError({
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
      title="Fehler beim Laden"
      message="Die Mitgliederverwaltung konnte nicht geladen werden."
    />
  );
}

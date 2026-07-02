'use client';

import { PageError } from '@/components/ui/page-error';

export default function TenantsError({
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
      title="Fehler beim Laden der Mandanten"
      message="Die Mandantendaten konnten nicht geladen werden."
    />
  );
}

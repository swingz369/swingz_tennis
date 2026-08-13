'use client';

import { PageError } from '@/components/ui/page-error';

export default function BillingError({
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
      message="Die Abrechnungsübersicht konnte nicht geladen werden."
    />
  );
}

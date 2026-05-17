'use client';

import { PageError } from '@/components/ui/page-error';

export default function ShopError({
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
      title="Fehler beim Laden des Shops"
      message="Der Shop konnte nicht geladen werden."
    />
  );
}

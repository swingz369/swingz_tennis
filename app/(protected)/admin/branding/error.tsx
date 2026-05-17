'use client';

import { PageError } from '@/components/ui/page-error';

export default function BrandingError({
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
      title="Fehler beim Laden des Brandings"
      message="Die Branding-Einstellungen konnten nicht geladen werden."
    />
  );
}

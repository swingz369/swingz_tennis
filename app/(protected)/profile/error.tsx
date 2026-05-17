'use client';

import { PageError } from '@/components/ui/page-error';

export default function ProfileError({
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
      title="Fehler beim Laden des Profils"
      message="Das Profil konnte nicht geladen werden."
    />
  );
}

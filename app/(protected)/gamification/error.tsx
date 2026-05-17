'use client';

import { PageError } from '@/components/ui/page-error';

export default function GamificationError({
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
      title="Fehler beim Laden der Gamification"
      message="Die Gamification-Daten konnten nicht geladen werden."
    />
  );
}

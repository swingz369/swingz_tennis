'use client';

import { PageError } from '@/components/ui/page-error';

export default function MemberError({
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
      title="Fehler beim Laden des Mitgliederbereichs"
      message="Der Mitgliederbereich konnte nicht geladen werden."
      dashboardHref="/member"
    />
  );
}

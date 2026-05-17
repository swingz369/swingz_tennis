'use client';

import { PageError } from '@/components/ui/page-error';

export default function ReportsError({
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
      title="Fehler beim Laden der Berichte"
      message="Die Berichte konnten nicht geladen werden."
      dashboardHref="/admin"
    />
  );
}

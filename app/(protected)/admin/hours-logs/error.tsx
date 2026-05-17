'use client';

import { PageError } from '@/components/ui/page-error';

export default function HoursLogsError({
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
      title="Fehler beim Laden der Stundennachweise"
      message="Die Stundennachweise konnten nicht geladen werden."
    />
  );
}

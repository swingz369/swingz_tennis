'use client';

import { PageError } from '@/components/ui/page-error';

export default function AttendanceHistoryError({
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
      title="Fehler beim Laden der Anwesenheitshistorie"
      message="Die Anwesenheitsdaten konnten nicht geladen werden."
    />
  );
}

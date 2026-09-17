'use client';

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SessionCancelDialog } from '@/components/session-cancel-dialog';
import type { Session } from '@/hooks/use-sessions';

/** Zustand + Dialog fürs Absagen eines Trainings (Admin) — Klick auf
 *  "Training absagen" irgendwo im Kalender öffnet dasselbe Modal. */
export function useSessionCancelDialog() {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionLabel, setSessionLabel] = useState('');

  const open = useCallback((session: Session) => {
    const start = session.timeslotStart ? new Date(session.timeslotStart) : null;
    const label = start
      ? start.toLocaleString('de-DE', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        }) + ' Uhr'
      : `${session.startTime}–${session.endTime}`;
    setSessionId(session.id);
    setSessionLabel(label);
  }, []);

  const dialog = sessionId && (
    <SessionCancelDialog
      open={!!sessionId}
      onClose={() => setSessionId(null)}
      sessionId={sessionId}
      sessionLabel={sessionLabel}
      onSuccess={() => {
        setSessionId(null);
        void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      }}
    />
  );

  return { open, dialog };
}

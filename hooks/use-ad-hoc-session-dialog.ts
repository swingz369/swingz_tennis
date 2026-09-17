import { useCallback, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import { extractErrorMessage } from '@/lib/typed-helpers';

export interface AdHocSessionDialogState {
  isOpen: boolean;
  courtId: string;
  date: Date;
  timeSlot: string;
  duration: number;
  maxParticipants: number;
  notes: string;
  loading: boolean;
  /** Setzt Ziel (Platz/Datum/Zeit) + Felder zurück, ohne das Modal zu öffnen —
   *  für das Inline-Panel der Agenda-Ansicht, das dieselben Felder benutzt. */
  setTarget: (courtId: string, date: Date, timeSlot: string) => void;
  /** Wie setTarget, öffnet zusätzlich das Modal — für Wochen-/Tagesansicht. */
  open: (courtId: string, date: Date, timeSlot: string) => void;
  close: () => void;
  setDuration: (duration: number) => void;
  setMaxParticipants: (max: number) => void;
  setNotes: (notes: string) => void;
  submit: () => Promise<void>;
}

/** Zustand + Absende-Logik für "Einheit eintragen" (Trainer-Ad-hoc-Session) —
 *  geteilt zwischen Modal (Wochen-/Tagesansicht) und Inline-Panel
 *  (Agenda-Ansicht), da beide dieselben Felder befüllen. */
export function useAdHocSessionDialog({
  clubId,
  onCreated,
}: {
  clubId: string | null;
  onCreated: () => void;
}): AdHocSessionDialogState {
  const [isOpen, setIsOpen] = useState(false);
  const [courtId, setCourtId] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [timeSlot, setTimeSlot] = useState('');
  const [duration, setDuration] = useState(1);
  const [maxParticipants, setMaxParticipants] = useState(4);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const setTarget = useCallback(
    (targetCourtId: string, targetDate: Date, targetTimeSlot: string) => {
      setCourtId(targetCourtId);
      setDate(targetDate);
      setTimeSlot(targetTimeSlot);
      setDuration(1);
      setMaxParticipants(4);
      setNotes('');
    },
    []
  );

  const open = useCallback(
    (targetCourtId: string, targetDate: Date, targetTimeSlot: string) => {
      setTarget(targetCourtId, targetDate, targetTimeSlot);
      setIsOpen(true);
    },
    [setTarget]
  );

  const close = useCallback(() => setIsOpen(false), []);

  const submit = useCallback(async () => {
    if (!clubId) return;
    const [h, m] = timeSlot.split(':').map(Number);
    if (h + duration > 23) {
      toast.error('Einheit endet nach 23:00 Uhr — bitte kürzere Dauer wählen');
      return;
    }
    setLoading(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const endH = h + duration;
      const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

      const res = await apiFetch('/api/sessions/ad-hoc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courtId,
          date: dateStr,
          startTime: timeSlot,
          endTime,
          clubId,
          maxParticipants,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(extractErrorMessage(err) ?? 'Einheit konnte nicht angelegt werden');
        return;
      }
      toast.success('Einheit eingetragen');
      setIsOpen(false);
      onCreated();
    } catch {
      toast.error('Netzwerkfehler beim Eintragen');
    } finally {
      setLoading(false);
    }
  }, [clubId, courtId, date, timeSlot, duration, maxParticipants, notes, onCreated]);

  return {
    isOpen,
    courtId,
    date,
    timeSlot,
    duration,
    maxParticipants,
    notes,
    loading,
    setTarget,
    open,
    close,
    setDuration,
    setMaxParticipants,
    setNotes,
    submit,
  };
}

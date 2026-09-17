import { useCallback, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import { extractErrorMessage } from '@/lib/typed-helpers';

export type BlockType = 'event' | 'maintenance' | 'weather';

export interface BlockCourtDialogState {
  isOpen: boolean;
  courtId: string;
  date: Date;
  timeSlot: string;
  type: BlockType;
  reason: string;
  duration: number;
  loading: boolean;
  /** Setzt Ziel (Platz/Datum/Zeit) + Felder zurück, ohne das Modal zu öffnen —
   *  für das Inline-Panel der Agenda-Ansicht, das dieselben Felder benutzt. */
  setTarget: (courtId: string, date: Date, timeSlot: string) => void;
  /** Wie setTarget, öffnet zusätzlich das Modal — für Wochen-/Tagesansicht. */
  open: (courtId: string, date: Date, timeSlot: string) => void;
  close: () => void;
  setType: (type: BlockType) => void;
  setReason: (reason: string) => void;
  setDuration: (duration: number) => void;
  submit: () => Promise<void>;
}

/** Zustand + Absende-Logik für die "Platz sperren"-Dialoge/Inline-Panels des
 *  Platzkalenders — geteilt zwischen Modal (Wochen-/Tagesansicht) und
 *  Inline-Panel (Agenda-Ansicht), da beide dieselben Felder befüllen. */
export function useBlockCourtDialog({
  clubId,
  onBlocked,
}: {
  clubId: string | null;
  onBlocked: () => void;
}): BlockCourtDialogState {
  const [isOpen, setIsOpen] = useState(false);
  const [courtId, setCourtId] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [timeSlot, setTimeSlot] = useState('');
  const [type, setType] = useState<BlockType>('event');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState(1);
  const [loading, setLoading] = useState(false);

  const setTarget = useCallback(
    (targetCourtId: string, targetDate: Date, targetTimeSlot: string) => {
      setCourtId(targetCourtId);
      setDate(targetDate);
      setTimeSlot(targetTimeSlot);
      setType('event');
      setReason('');
      setDuration(1);
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
      toast.error('Sperrung endet nach 23:00 Uhr — bitte kürzere Dauer wählen');
      return;
    }
    setLoading(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const endH = h + duration;
      const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

      const res = await apiFetch('/api/sessions/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courtId,
          date: dateStr,
          startTime: timeSlot,
          endTime,
          clubId,
          blockType: type === 'weather' ? 'maintenance' : type,
          reason: reason || (type === 'weather' ? 'Wetterbedingungen' : undefined),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(extractErrorMessage(err) ?? 'Sperrung fehlgeschlagen');
        return;
      }
      const blockLabel =
        type === 'event' ? 'Veranstaltung' : type === 'weather' ? 'Wetter' : 'Wartung';
      toast.success(`${blockLabel}-Sperre gesetzt`);
      setIsOpen(false);
      onBlocked();
    } catch {
      toast.error('Netzwerkfehler beim Sperren');
    } finally {
      setLoading(false);
    }
  }, [clubId, courtId, date, timeSlot, type, reason, duration, onBlocked]);

  return {
    isOpen,
    courtId,
    date,
    timeSlot,
    type,
    reason,
    duration,
    loading,
    setTarget,
    open,
    close,
    setType,
    setReason,
    setDuration,
    submit,
  };
}

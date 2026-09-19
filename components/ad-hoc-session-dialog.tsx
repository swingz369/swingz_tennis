'use client';

import { format } from 'date-fns';
import { de } from '@/lib/locale';
import { CenteredModal } from '@/components/ui/centered-modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarIcon } from 'lucide-react';
import type { Court } from '@/hooks/use-courts';

interface AdHocSessionDialogProps {
  open: boolean;
  onClose: () => void;
  courtId: string;
  courts: Court[];
  date: Date;
  timeSlot: string;
  duration: number;
  onDurationChange: (hours: number) => void;
  maxParticipants: number;
  onMaxParticipantsChange: (max: number) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

/**
 * Extrahiert aus unified-court-calendar.tsx (16.09.2026, tokensave-Fund:
 * 2175 Zeilen/CC 229 in einer einzigen Funktion). Reiner JSX-Ausschnitt ohne
 * Logikänderung — Zustand bleibt bewusst im Elternteil, weil dieselben
 * Setter auch vom Inline-Panel (kein Modal) im Kalender selbst befüllt
 * werden.
 */
export function AdHocSessionDialog({
  open,
  onClose,
  courtId,
  courts,
  date,
  timeSlot,
  duration,
  onDurationChange,
  maxParticipants,
  onMaxParticipantsChange,
  notes,
  onNotesChange,
  onSubmit,
  loading,
}: AdHocSessionDialogProps) {
  return (
    <CenteredModal open={open} onClose={onClose}>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          Einheit eintragen
        </h2>
        <p className="text-sm text-muted-foreground">
          Trägt eine einmalige Trainingseinheit auf{' '}
          {courtId && courts.find((c) => c.id === courtId)?.name} am{' '}
          {format(date, 'dd.MM.yyyy', { locale: de })} um {timeSlot} Uhr ein.
        </p>
      </div>

      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="adhoc-duration">Dauer (Stunden)</Label>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((h) => (
              <Button
                key={h}
                variant={duration === h ? 'default' : 'outline'}
                size="sm"
                onClick={() => onDurationChange(h)}
              >
                {h}h
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="adhoc-max">Max. Teilnehmer</Label>
          <Input
            id="adhoc-max"
            type="number"
            min={1}
            max={20}
            value={maxParticipants}
            onChange={(e) => onMaxParticipantsChange(parseInt(e.target.value, 10) || 4)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="adhoc-notes">Notiz (optional)</Label>
          <Input
            id="adhoc-notes"
            placeholder="z.B. Zusatztraining Kids..."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>
          Abbrechen
        </Button>
        <Button onClick={onSubmit} disabled={loading}>
          {loading ? 'Wird eingetragen...' : 'Einheit eintragen'}
        </Button>
      </div>
    </CenteredModal>
  );
}

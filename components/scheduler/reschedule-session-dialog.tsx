'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CenteredModal } from '@/components/ui/centered-modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api-fetch';
import type { Session } from '@/hooks/use-sessions';

const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

interface RescheduleSessionDialogProps {
  session: Session;
  onClose: () => void;
  onSuccess: () => void;
}

export function RescheduleSessionDialog({
  session,
  onClose,
  onSuccess,
}: RescheduleSessionDialogProps) {
  // session.dayOfWeek: API-Konvention 1=Mo..7=So → Formular-Konvention 0=Mo..6=So
  const [dayOfWeek, setDayOfWeek] = useState(String((session.dayOfWeek ?? 1) - 1));
  const [startTime, setStartTime] = useState(session.startTime ?? '');
  const [endTime, setEndTime] = useState(session.endTime ?? '');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!session.planEntryId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/plan-entries/${session.planEntryId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_of_week: Number(dayOfWeek),
          start_time: startTime,
          end_time: endTime,
          effective_from: effectiveFrom,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.details ?? extractErrorMessage(data) ?? 'Verschieben fehlgeschlagen');
        return;
      }
      toast.success(data.message ?? 'Trainingszeit verschoben');
      onSuccess();
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CenteredModal open onClose={onClose}>
      <div className="space-y-1.5">
        <h2 className="text-lg font-bold">Trainingszeit verschieben</h2>
        <p className="text-sm text-muted-foreground">
          Ändert alle künftigen Termine dieser Gruppe — vergangene Termine bleiben unverändert.
        </p>
      </div>
      <div className="space-y-4">
        <div>
          <Label>Wochentag</Label>
          <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
            <SelectTrigger className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKDAYS.map((label, i) => (
                <SelectItem key={label} value={String(i)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Label htmlFor="reschedule_start">Startzeit</Label>
            <Input
              id="reschedule_start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="reschedule_end">Endzeit</Label>
            <Input
              id="reschedule_end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="reschedule_from">Gültig ab</Label>
          <Input
            id="reschedule_from"
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            className="mt-1 max-w-xs"
          />
        </div>
        {error && <p className="text-sm text-error-600">{error}</p>}
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>
          Abbrechen
        </Button>
        <Button onClick={handleSubmit} disabled={submitting || !startTime || !endTime}>
          {submitting ? 'Wird verschoben…' : 'Verschieben'}
        </Button>
      </div>
    </CenteredModal>
  );
}

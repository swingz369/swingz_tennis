'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, CalendarCheck, Clock, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CenteredModal } from '@/components/ui/centered-modal';
import { LoadingButton } from '@/components/ui/loading-button';
import { apiFetch } from '@/lib/api-fetch';
import { de } from '@/lib/locale';

export interface PendingBooking {
  courtId: string;
  courtName: string;
  date: Date;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  /** Bestehende Trainingsstunde statt freier Platzzeit — dafür gibt es keine Vorprüfung. */
  isSession: boolean;
  sessionId?: string;
}

interface Usage {
  day: { used: number; max: number | null };
  week: { used: number; max: number | null };
  concurrent: { used: number; max: number | null };
}

type Preview =
  | { state: 'loading' }
  | { state: 'ready'; requiresApproval: boolean; requiresPayment: boolean; usage: Usage }
  | { state: 'blocked'; error: string; usage?: Usage }
  | { state: 'unknown' };

interface Props {
  pending: PendingBooking | null;
  clubId: string | null;
  memberId: string | null;
  submitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

function UsageLine({ label, u }: { label: string; u: { used: number; max: number | null } }) {
  if (!u.max) return null;
  const after = u.used + 1;
  return (
    <li className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">
        {after} von {u.max} <span className="text-muted-foreground">nach dieser Buchung</span>
      </span>
    </li>
  );
}

/** Bestätigungsdialog vor einer Platzbuchung — prüft vorab die Buchungsregeln des Vereins. */
export function BookingConfirmDialog({
  pending,
  clubId,
  memberId,
  submitting,
  onConfirm,
  onClose,
}: Props) {
  const [preview, setPreview] = useState<Preview>({ state: 'loading' });

  useEffect(() => {
    if (!pending || !clubId || !memberId) return;
    if (pending.isSession) {
      setPreview({ state: 'unknown' });
      return;
    }
    let cancelled = false;
    setPreview({ state: 'loading' });
    apiFetch('/api/bookings/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courtId: pending.courtId,
        date: format(pending.date, 'yyyy-MM-dd'),
        startTime: pending.startTime,
        endTime: pending.endTime,
        clubId,
      }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !body) {
          setPreview({ state: 'unknown' });
        } else if (body.allowed) {
          setPreview({ state: 'ready', ...body });
        } else {
          setPreview({ state: 'blocked', error: body.error ?? 'Nicht buchbar', usage: body.usage });
        }
      })
      .catch(() => {
        if (!cancelled) setPreview({ state: 'unknown' });
      });
    return () => {
      cancelled = true;
    };
  }, [pending, clubId, memberId]);

  if (!pending) return null;

  const blocked = preview.state === 'blocked';
  const loading = preview.state === 'loading';

  return (
    <CenteredModal
      open
      onClose={submitting ? () => {} : onClose}
      className="sm:max-w-[440px]"
      ariaLabel="Platz verbindlich buchen"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-full bg-primary/10">
          <CalendarCheck className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-lg font-semibold leading-none tracking-tight">
          Platz verbindlich buchen?
        </h2>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
          {pending.courtName}
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
          {format(pending.date, 'EEEE, d. MMMM yyyy', { locale: de })}, {pending.startTime}–
          {pending.endTime} Uhr
        </div>
      </div>

      <div className="mt-4 text-sm" aria-live="polite">
        {loading && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Buchungsregeln werden geprüft…
          </p>
        )}
        {blocked && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive"
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
            {preview.error}
          </p>
        )}
        {preview.state === 'ready' && (
          <div className="space-y-3">
            <ul className="space-y-1">
              <UsageLine label="Buchungen heute" u={preview.usage.day} />
              <UsageLine label="Buchungen diese Woche" u={preview.usage.week} />
              <UsageLine label="Offene Buchungen" u={preview.usage.concurrent} />
            </ul>
            {preview.requiresApproval && (
              <p className="text-muted-foreground">
                Die Buchung wird erst nach Freigabe durch den Verein verbindlich.
              </p>
            )}
            {preview.requiresPayment && (
              <p className="text-muted-foreground">Für diese Buchung ist eine Zahlung nötig.</p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2 pt-4 mt-4 border-t border-border">
        <Button variant="outline" onClick={onClose} disabled={submitting} className="mt-2 sm:mt-0">
          Abbrechen
        </Button>
        <LoadingButton loading={submitting} disabled={blocked || loading} onClick={onConfirm}>
          Verbindlich buchen
        </LoadingButton>
      </div>
    </CenteredModal>
  );
}

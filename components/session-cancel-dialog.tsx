'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CenteredModal } from '@/components/ui/centered-modal';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';

const log = createLogger('session-cancel-dialog');

interface SessionCancelDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  sessionLabel: string; // z.B. "Montag, 23. Juni um 10:00 Uhr"
  onSuccess: () => void;
}

export function SessionCancelDialog({
  open,
  onClose,
  sessionId,
  sessionLabel,
  onSuccess,
}: SessionCancelDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      toast.error('Bitte gib einen Grund für die Absage an.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/sessions/${sessionId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: trimmedReason }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(extractErrorMessage(data) ?? 'Absage fehlgeschlagen');
        return;
      }

      toast.success(
        `Training abgesagt. ${data.notifiedCount} Mitglied${data.notifiedCount !== 1 ? 'er' : ''} benachrichtigt.`
      );
      onSuccess();
      onClose();
      setReason('');
    } catch (err) {
      log.error('Fehler bei der Session-Absage', err instanceof Error ? err : undefined);
      toast.error('Netzwerkfehler — bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CenteredModal open={open} onClose={onClose}>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold">Training absagen</h2>
        <p className="text-sm text-muted-foreground">{sessionLabel}</p>
      </div>

      <div className="space-y-4 pt-2">
        <div>
          <Label htmlFor="cancel-reason">
            Grund der Absage <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="z.B. Trainer erkrankt, Platz nicht verfügbar, …"
            className="mt-1.5"
            rows={3}
            disabled={loading}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Alle gebuchten Mitglieder erhalten eine Benachrichtigung mit diesem Grund.
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button variant="destructive" onClick={handleCancel} disabled={loading || !reason.trim()}>
            {loading ? 'Wird abgesagt…' : 'Training absagen'}
          </Button>
        </div>
      </div>
    </CenteredModal>
  );
}

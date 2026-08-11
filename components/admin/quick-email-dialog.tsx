'use client';

import { useState } from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';

export interface QuickEmailDialogProps {
  userId: string;
  recipientName: string;
  recipientEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Sends one immediate email to a single member/trainer via POST /api/admin/quick-email. */
export function QuickEmailDialog({
  userId,
  recipientName,
  recipientEmail,
  open,
  onOpenChange,
}: QuickEmailDialogProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!subject.trim() || !body.trim()) {
      toast.error('Betreff und Nachricht erforderlich');
      return;
    }
    setSending(true);
    try {
      const res = await apiFetch('/api/admin/quick-email', {
        method: 'POST',
        body: JSON.stringify({ userId, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'E-Mail konnte nicht gesendet werden');
        return;
      }
      toast.success(`E-Mail an ${recipientName} gesendet`);
      setSubject('');
      setBody('');
      onOpenChange(false);
    } catch {
      toast.error('E-Mail konnte nicht gesendet werden');
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            E-Mail an {recipientName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Empfänger</Label>
            <p className="text-sm text-muted-foreground">{recipientEmail}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quick-email-subject">Betreff</Label>
            <Input
              id="quick-email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Betreff eingeben"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quick-email-body">Nachricht</Label>
            <Textarea
              id="quick-email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Nachricht eingeben"
              rows={6}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Abbrechen
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? 'Wird gesendet…' : 'Senden'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

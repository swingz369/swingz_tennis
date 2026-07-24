'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';

export interface ClosureCourtOption {
  id: string;
  name: string;
  surface?: string;
}

function emptyForm(defaultCourtId?: string) {
  return {
    court_id: defaultCourtId ?? '',
    reason: 'maintenance',
    description: '',
    start_date: '',
    end_date: '',
    notify_members: false,
  };
}

/** Shared "Platz sperren/reservieren" dialog — Platzverwaltung + Wochenstundenplan nutzen dieselbe API (court_closures). */
export function CourtClosureFormDialog({
  open,
  onOpenChange,
  courts,
  defaultCourtId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courts: ClosureCourtOption[];
  defaultCourtId?: string;
  onCreated?: () => void;
}) {
  const [form, setForm] = useState(emptyForm(defaultCourtId));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.court_id || !form.start_date) {
      toast.error('Platz und Startdatum erforderlich');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch('/api/weather/closures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Platzsperre erstellt');
      setForm(emptyForm(defaultCourtId));
      onOpenChange(false);
      onCreated?.();
    } catch {
      toast.error('Fehler beim Erstellen der Platzsperre');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setForm(emptyForm(defaultCourtId));
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Platz sperren / reservieren</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cc-court" className="text-xs font-medium">
                Platz
              </label>
              <select
                id="cc-court"
                value={form.court_id}
                onChange={(e) => setForm({ ...form, court_id: e.target.value })}
                className="w-full mt-1 p-2 rounded border bg-background text-sm"
              >
                <option value="">Platz wählen…</option>
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.surface ? ` (${c.surface})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="cc-reason" className="text-xs font-medium">
                Grund
              </label>
              <select
                id="cc-reason"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full mt-1 p-2 rounded border bg-background text-sm"
              >
                <option value="maintenance">Wartung / Reparatur</option>
                <option value="event">Veranstaltung / Schulklasse</option>
                <option value="tournament">Vereinsturnier</option>
                <option value="weather">Wetter</option>
                <option value="other">Sonstiges</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cc-start" className="text-xs font-medium">
                Von
              </label>
              <Input
                id="cc-start"
                type="datetime-local"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="cc-end" className="text-xs font-medium">
                Bis (optional)
              </label>
              <Input
                id="cc-end"
                type="datetime-local"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <Input
            placeholder="Beschreibung (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.notify_members || form.reason === 'tournament'}
              disabled={form.reason === 'tournament'}
              onChange={(e) => setForm({ ...form, notify_members: e.target.checked })}
              className="rounded"
            />
            <span>
              Alle Mitglieder benachrichtigen
              {form.reason === 'tournament' && (
                <span className="ml-1 text-xs text-muted-foreground">
                  (bei Vereinsturnier automatisch)
                </span>
              )}
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Wird erstellt...' : 'Sperre erstellen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

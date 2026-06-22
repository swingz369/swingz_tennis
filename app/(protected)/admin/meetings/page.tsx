'use client';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';

type Meeting = {
  id: string;
  title: string;
  meeting_date: string;
  location: string;
  description: string;
  status: string;
};

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', meeting_date: '', location: '', description: '' });

  useEffect(() => {
    apiFetch('/api/admin/meetings')
      .then((r) => r.json())
      .then((d) => setMeetings(d.meetings ?? []));
  }, []);

  const save = async () => {
    if (!form.title || !form.meeting_date) {
      toast.error('Titel und Datum erforderlich');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Fehler');
        return;
      }
      setMeetings((prev) => [data.meeting, ...prev]);
      setOpen(false);
      setForm({ title: '', meeting_date: '', location: '', description: '' });
      toast.success('Versammlung angelegt');
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: string) => {
    await apiFetch(`/api/admin/meetings/${id}`, { method: 'DELETE' });
    setMeetings((prev) => prev.filter((m) => m.id !== id));
    toast.success('Gelöscht');
  };

  const statusColor: Record<string, string> = {
    geplant: 'secondary',
    abgeschlossen: 'outline',
    abgesagt: 'destructive',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mitgliederversammlungen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Versammlungen planen und dokumentieren.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Versammlung anlegen
        </Button>
      </div>

      <div className="grid gap-3">
        {meetings.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Noch keine Versammlungen geplant.
            </CardContent>
          </Card>
        )}
        {meetings.map((m) => (
          <Card key={m.id}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20 shrink-0 mt-0.5">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{m.title}</p>
                  <Badge
                    variant={(statusColor[m.status] as any) ?? 'secondary'}
                    className="text-xs"
                  >
                    {m.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(m.meeting_date).toLocaleString('de-DE', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
                {m.location && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <MapPin className="h-3 w-3" />
                    {m.location}
                  </p>
                )}
                {m.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.description}</p>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive shrink-0"
                onClick={() => del(m.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Versammlung anlegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Titel *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Jahreshauptversammlung 2026"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Datum & Uhrzeit *</Label>
              <Input
                type="datetime-local"
                value={form.meeting_date}
                onChange={(e) => setForm((p) => ({ ...p, meeting_date: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Ort</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                placeholder="Clubhaus, Saal 1"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Beschreibung / Tagesordnung</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="mt-1.5 resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

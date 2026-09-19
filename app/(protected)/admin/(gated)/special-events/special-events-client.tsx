'use client';

import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';
import { Plus, Calendar, Users, Euro, Pencil, Trash2, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from '@/lib/locale';
import { PageHeader } from '@/components/ui/page-header';

type EventType =
  'sommercamp' | 'intensivkurs' | 'schnupperkurs' | 'turnier' | 'social' | 'sonstiges';
type EventStatus = 'draft' | 'open' | 'full' | 'cancelled' | 'completed';

interface SpecialEvent {
  id: string;
  name: string;
  event_type: EventType;
  description?: string;
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  max_participants: number;
  price_per_person: number;
  status: EventStatus;
}

const TYPE_LABELS: Record<EventType, string> = {
  sommercamp: 'Sommercamp',
  intensivkurs: 'Intensivkurs',
  schnupperkurs: 'Schnupperkurs',
  turnier: 'Turnier',
  social: 'Social Event',
  sonstiges: 'Sonstiges',
};
const STATUS_COLORS: Record<
  EventStatus,
  'success' | 'secondary' | 'warning' | 'error' | 'outline'
> = {
  draft: 'secondary',
  open: 'success',
  full: 'warning',
  cancelled: 'error',
  completed: 'outline',
};
const STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'Entwurf',
  open: 'Offen',
  full: 'Ausgebucht',
  cancelled: 'Abgesagt',
  completed: 'Abgeschlossen',
};
const EMPTY: Omit<SpecialEvent, 'id'> = {
  name: '',
  event_type: 'sommercamp',
  description: '',
  start_date: '',
  end_date: '',
  start_time: '09:00',
  end_time: '17:00',
  location: '',
  max_participants: 12,
  price_per_person: 0,
  status: 'draft',
};

export function SpecialEventsClient() {
  const [events, setEvents] = useState<SpecialEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SpecialEvent | null>(null);
  const [form, setForm] = useState<Omit<SpecialEvent, 'id'>>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/special-events');
      setEvents((await res.json()).events ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setShowForm(true);
  };
  const openEdit = (e: SpecialEvent) => {
    setEditing(e);
    setForm(e);
    setShowForm(true);
  };
  const f = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name || !form.start_date || !form.end_date) {
      toast.error('Name und Datum sind Pflichtfelder');
      return;
    }
    setSaving(true);
    try {
      const res = editing
        ? await apiFetch(`/api/admin/special-events/${editing.id}`, {
            method: 'PATCH',
            body: JSON.stringify(form),
          })
        : await apiFetch('/api/admin/special-events', {
            method: 'POST',
            body: JSON.stringify(form),
          });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(editing ? 'Event aktualisiert' : 'Event erstellt');
      setShowForm(false);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setSaving(false);
    }
  };

  const [confirm, confirmDialog] = useConfirmDialog();

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Veranstaltung löschen',
      description: `"${name}" wirklich löschen?`,
      confirmLabel: 'Löschen',
    });
    if (!ok) return;
    await apiFetch(`/api/admin/special-events/${id}`, { method: 'DELETE' });
    toast.success('Gelöscht');
    load();
  };

  return (
    <div className="space-y-6">
      {confirmDialog}
      <PageHeader
        title="Sonderveranstaltungen"
        description="Sommercamp, Intensivkurse, Schnupperstunden & mehr"
        actions={[{ label: 'Event erstellen', icon: Plus, onClick: openCreate }]}
      />

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowForm(false)}
          onKeyDown={(e) => e.key === 'Escape' && setShowForm(false)}
          role="button"
          tabIndex={-1}
          aria-label="Modal schließen"
        >
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <div
            className="bg-card rounded-xl border border-border shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="p-5 border-b border-border">
              <h2 className="text-lg font-semibold">
                {editing ? 'Event bearbeiten' : 'Neues Event'}
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <Label htmlFor="event-name">Name *</Label>
                <Input
                  id="event-name"
                  value={form.name}
                  onChange={(e) => f('name', e.target.value)}
                  placeholder="z.B. Sommercamp 2026"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="event-type">Typ</Label>
                  <select
                    id="event-type"
                    value={form.event_type}
                    onChange={(e) => f('event_type', e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="event-status">Status</Label>
                  <select
                    id="event-status"
                    value={form.status}
                    onChange={(e) => f('status', e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="event-start-date">Start *</Label>
                  <Input
                    id="event-start-date"
                    type="date"
                    value={form.start_date}
                    onChange={(e) => f('start_date', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="event-end-date">Ende *</Label>
                  <Input
                    id="event-end-date"
                    type="date"
                    value={form.end_date}
                    onChange={(e) => f('end_date', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="event-start-time">Von</Label>
                  <Input
                    id="event-start-time"
                    type="time"
                    value={form.start_time}
                    onChange={(e) => f('start_time', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="event-end-time">Bis</Label>
                  <Input
                    id="event-end-time"
                    type="time"
                    value={form.end_time}
                    onChange={(e) => f('end_time', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="event-max-participants">Max. Teilnehmer</Label>
                  <Input
                    id="event-max-participants"
                    type="number"
                    min={1}
                    value={form.max_participants}
                    onChange={(e) => f('max_participants', Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="event-price">Preis/Person (€)</Label>
                  <Input
                    id="event-price"
                    type="number"
                    min={0}
                    step={0.5}
                    value={form.price_per_person}
                    onChange={(e) => f('price_per_person', Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="event-location">Ort / Platz</Label>
                <Input
                  id="event-location"
                  value={form.location ?? ''}
                  onChange={(e) => f('location', e.target.value)}
                  placeholder="z.B. Platz 1+2"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="event-description">Beschreibung</Label>
                <textarea
                  id="event-description"
                  value={form.description ?? ''}
                  onChange={(e) => f('description', e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>
            <div className="p-5 border-t border-border flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSave} disabled={saving} variant="primary" className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? 'Speichern' : 'Erstellen'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted-foreground">
            Noch keine Events — erstelle das erste.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => (
            <Card key={ev.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm">{ev.name}</h3>
                    <Badge variant="outline" className="text-xs">
                      {TYPE_LABELS[ev.event_type]}
                    </Badge>
                    <Badge variant={STATUS_COLORS[ev.status]} className="text-xs">
                      {STATUS_LABELS[ev.status]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(parseISO(ev.start_date), 'dd. MMM', { locale: de })}
                      {ev.start_date !== ev.end_date &&
                        ` – ${format(parseISO(ev.end_date), 'dd. MMM yyyy', { locale: de })}`}
                      {ev.start_time && ` · ${ev.start_time}–${ev.end_time}`}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Max. {ev.max_participants}
                    </span>
                    <span className="flex items-center gap-1">
                      <Euro className="h-3 w-3" />
                      {ev.price_per_person === 0
                        ? 'Kostenlos'
                        : `${Number(ev.price_per_person).toFixed(2)} €`}
                    </span>
                    {ev.location && <span>{ev.location}</span>}
                  </div>
                  {ev.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {ev.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEdit(ev)}
                    className="h-8 w-8 p-0"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(ev.id, ev.name)}
                    className="h-8 w-8 p-0 text-error-500 hover:text-error-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

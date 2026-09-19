'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Wrench, Loader2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { apiFetch, fetchJson } from '@/lib/api-fetch';
import { ListState } from '@/components/ui/list-state';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type Item = {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
  courts?: { name: string };
};
const STATUSES = ['geplant', 'laufend', 'abgeschlossen', 'abgesagt'];
const statusColor: Record<string, string> = {
  geplant: 'secondary',
  laufend: 'default',
  abgeschlossen: 'outline',
  abgesagt: 'destructive',
};

export function MaintenanceTab() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  // Ein 403 darf nicht als "keine Wartung" durchgehen (PRODUKTIONSREIFE.md 4.5).
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'geplant',
  });

  useEffect(() => {
    fetchJson<{ items?: Item[] }>('/api/admin/maintenance')
      .then((d) => setItems(d.items ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!form.title || !form.start_date || !form.end_date) {
      toast.error('Pflichtfelder ausfüllen');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(extractErrorMessage(data) ?? 'Fehler');
        return;
      }
      setItems((prev) => [data.item, ...prev]);
      setOpen(false);
      setForm({ title: '', description: '', start_date: '', end_date: '', status: 'geplant' });
      toast.success('Wartung eingetragen');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await apiFetch(`/api/admin/maintenance/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
  };

  const del = async (id: string) => {
    await apiFetch(`/api/admin/maintenance/${id}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success('Gelöscht');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Wartungsplan</h2>
          <p className="text-sm text-muted-foreground">Geplante Sperrungen für Instandhaltung</p>
        </div>
        <Button className="gap-2" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Wartung eintragen
        </Button>
      </div>

      <div className="grid gap-3">
        {(loading || error || items.length === 0) && (
          <Card>
            <CardContent className="p-2">
              <ListState
                loading={loading}
                error={error}
                empty={items.length === 0}
                emptyTitle="Keine Wartungseinträge vorhanden"
                emptyHint="Platzpflege, Netzwechsel, Winterdienst — hier eintragen, damit die Plätze in der Zeit nicht buchbar sind."
              />
            </CardContent>
          </Card>
        )}
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning-50 shrink-0 mt-0.5">
                <Wrench className="h-4 w-4 text-warning-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{item.title}</p>
                  <Badge variant={statusColor[item.status] as any} className="text-xs">
                    {item.status}
                  </Badge>
                </div>
                {item.description && (
                  <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(item.start_date).toLocaleDateString('de-DE')} –{' '}
                  {new Date(item.end_date).toLocaleDateString('de-DE')}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Select value={item.status} onValueChange={(v) => updateStatus(item.id, v)}>
                  <SelectTrigger className="h-7 text-xs w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => del(item.id)}
                      aria-label="Löschen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Löschen</TooltipContent>
                </Tooltip>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wartung eintragen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Titel *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Platzsanierung Platz 1"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="mt-1.5 resize-none"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Von *</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Bis *</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { csrfHeaders } from '@/lib/csrf-client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

type Group = { id: string; name: string; level: string; age_group: string | null };
type Trainer = { id: string; full_name: string };
type Form = {
  name: string;
  level: string;
  age_group: string;
  max_participants: string;
  trainer_id: string;
  day: string;
  time: string;
};

const LEVELS = ['Anfänger', 'Fortgeschritten', 'Leistung', 'Profi'];
const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const empty = (): Form => ({
  name: '',
  level: '',
  age_group: '',
  max_participants: '8',
  trainer_id: '',
  day: 'Montag',
  time: '18:00',
});

export function GroupsManager({
  seasonId,
  initialGroups,
  trainers,
}: {
  seasonId: string;
  initialGroups: Group[];
  trainers: Trainer[];
}) {
  const router = useRouter();
  const [groups, setGroups] = useState(initialGroups);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [form, setForm] = useState<Form>(empty());
  const [saving, setSaving] = useState(false);

  function set(k: keyof Form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function openAdd() {
    setEditing(null);
    setForm(empty());
    setDialogOpen(true);
  }
  function openEdit(g: Group) {
    setEditing(g);
    setForm({
      name: g.name,
      level: g.level,
      age_group: g.age_group ?? '',
      max_participants: '8',
      trainer_id: '',
      day: 'Montag',
      time: '18:00',
    });
    setDialogOpen(true);
  }

  async function saveGroup() {
    setSaving(true);
    const payload = {
      name: form.name,
      level: form.level,
      age_group: form.age_group || null,
      max_participants: parseInt(form.max_participants, 10) || 8,
    };
    const res = await fetch(
      editing ? `/api/training-groups/${editing.id}` : '/api/training-groups',
      {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify(payload),
      }
    );
    setSaving(false);
    if (!res.ok) {
      toast.error('Fehler beim Speichern');
      return;
    }
    const saved = await res.json();
    setGroups((prev) =>
      editing ? prev.map((g) => (g.id === editing.id ? saved : g)) : [...prev, saved]
    );
    setDialogOpen(false);
    toast.success(editing ? 'Gruppe aktualisiert' : 'Gruppe hinzugefügt');
  }

  async function deleteGroup(id: string) {
    const res = await fetch(`/api/training-groups/${id}`, { method: 'DELETE', headers: csrfHeaders() });
    if (!res.ok) {
      toast.error('Fehler beim Löschen');
      return;
    }
    setGroups((prev) => prev.filter((g) => g.id !== id));
    toast.success('Gruppe gelöscht');
  }

  async function advance() {
    if (groups.length === 0) {
      toast.error('Mindestens eine Gruppe erforderlich');
      return;
    }
    await fetch(`/api/seasons/${seasonId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify({ planning_status: 'manual_review' }),
    });
    router.push(`/admin/seasons/${seasonId}/wizard/plan`);
    router.refresh();
  }

  return (
    <>
      <div className="space-y-3">
        {groups.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Noch keine Gruppen angelegt.
            </CardContent>
          </Card>
        )}
        {groups.map((g) => (
          <Card key={g.id}>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-base">{g.name}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{g.level}</Badge>
                <Button size="icon" variant="ghost" onClick={() => openEdit(g)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => deleteGroup(g.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}
        <Button variant="outline" className="w-full" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Gruppe hinzufügen
        </Button>
      </div>
      <div className="flex justify-end pt-6">
        <Button onClick={advance} disabled={groups.length === 0}>
          Weiter zu Plan
        </Button>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Gruppe bearbeiten' : 'Neue Gruppe'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="z.B. Anfänger Dienstag"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Level</Label>
                <Select value={form.level} onValueChange={(v) => set('level', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Trainer</Label>
                <Select value={form.trainer_id} onValueChange={(v) => set('trainer_id', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Trainer" />
                  </SelectTrigger>
                  <SelectContent>
                    {trainers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Wochentag</Label>
                <Select value={form.day} onValueChange={(v) => set('day', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Uhrzeit</Label>
              <Input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={saveGroup} disabled={saving || !form.name || !form.level}>
              {saving ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

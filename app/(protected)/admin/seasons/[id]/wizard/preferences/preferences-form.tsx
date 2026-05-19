'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { csrfHeaders } from '@/lib/csrf-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

type Season = {
  id: string;
  preferences_deadline: string | null;
  preferences_open: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auto_plan_config: any;
};

export function PreferencesForm({ seasonId, season }: { seasonId: string; season: Season }) {
  const router = useRouter();
  const cfg = (season.auto_plan_config ?? {}) as Record<string, unknown>; // eslint-disable-line
  const [deadline, setDeadline] = useState(season.preferences_deadline?.slice(0, 10) ?? '');
  const [open, setOpen] = useState(season.preferences_open ?? false);
  const [minSize, setMinSize] = useState(String(cfg.group_min_size ?? 4));
  const [maxSize, setMaxSize] = useState(String(cfg.group_max_size ?? 8));
  const [maxSessions, setMaxSessions] = useState(String(cfg.max_sessions_per_week ?? 3));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/seasons/${seasonId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
      body: JSON.stringify({
        preferences_deadline: deadline || null,
        preferences_open: open,
        planning_status: 'preferences_open',
        auto_plan_config: {
          ...cfg,
          group_min_size: +minSize,
          group_max_size: +maxSize,
          max_sessions_per_week: +maxSessions,
        },
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error('Fehler beim Speichern');
      return;
    }
    toast.success('Einstellungen gespeichert');
    router.push(`/admin/seasons/${seasonId}/wizard/groups`);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Planungs-Einstellungen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Präferenz-Deadline</Label>
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <Switch id="prefs-open" checked={open} onCheckedChange={setOpen} />
          <Label htmlFor="prefs-open">Präferenzen für Mitglieder öffnen</Label>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Min. Gruppengrösse</Label>
            <Input
              type="number"
              min={1}
              value={minSize}
              onChange={(e) => setMinSize(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Max. Gruppengrösse</Label>
            <Input
              type="number"
              min={1}
              value={maxSize}
              onChange={(e) => setMaxSize(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Max. Sessions/Woche</Label>
            <Input
              type="number"
              min={1}
              value={maxSessions}
              onChange={(e) => setMaxSessions(e.target.value)}
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Speichern...' : 'Speichern & Weiter'}
        </Button>
      </CardFooter>
    </Card>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWizard } from '@/lib/season-planning/wizard-context';
import { Loader2, Plus, X, Users } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';

interface SubstituteConfig {
  groupId: string;
  groupName: string;
  fromWeek: number;
  toWeek: number;
  substituteTrainerId: string;
  substituteTrainerName: string;
}

interface Trainer {
  id: string;
  name: string;
}

export function SubstituteTrainerPanel() {
  const { state } = useWizard();
  const [substitutes, setSubstitutes] = useState<SubstituteConfig[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [formGroupId, setFormGroupId] = useState('');
  const [formFromWeek, setFormFromWeek] = useState('1');
  const [formToWeek, setFormToWeek] = useState('26');
  const [formTrainerId, setFormTrainerId] = useState('');

  const groups = state.clusteringResult?.groups ?? [];

  useEffect(() => {
    if (groups.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      apiFetch(`/api/seasons/${state.seasonId}/planning/substitutes`).then((r) => r.json()),
      apiFetch(`/api/seasons/${state.seasonId}/planning/trainers`).then((r) => r.json()),
    ])
      .then(([subData, trainerData]) => {
        setSubstitutes(subData.substitutes || []);
        setTrainers(
          (trainerData.summary?.trainers || []).map(
            (t: { trainerId: string; trainerName: string }) => ({
              id: t.trainerId,
              name: t.trainerName,
            })
          )
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [state.seasonId, groups.length]);

  const handleAdd = async () => {
    if (!formGroupId || !formTrainerId) {
      toast.error('Bitte alle Felder ausfüllen');
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch(`/api/seasons/${state.seasonId}/planning/substitutes`, {
        method: 'POST',
        body: JSON.stringify({
          groupId: formGroupId,
          fromWeek: parseInt(formFromWeek, 10),
          toWeek: parseInt(formToWeek, 10),
          substituteTrainerId: formTrainerId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSubstitutes((prev) => [
          ...prev.filter((s) => s.groupId !== formGroupId),
          data.substitute,
        ]);
        setFormGroupId('');
        setFormFromWeek('1');
        setFormToWeek('26');
        setFormTrainerId('');
        setShowForm(false);
        toast.success('Vertretung hinzugefügt');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Fehler beim Hinzufügen');
      }
    } catch {
      toast.error('Netzwerkfehler');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (groupId: string) => {
    if (!confirm('Vertretung wirklich löschen?')) return;

    setSaving(true);
    try {
      const res = await apiFetch(`/api/seasons/${state.seasonId}/planning/substitutes`, {
        method: 'DELETE',
        body: JSON.stringify({ groupId }),
      });

      if (res.ok) {
        setSubstitutes((prev) => prev.filter((s) => s.groupId !== groupId));
        toast.success('Vertretung gelöscht');
      } else {
        toast.error('Fehler beim Löschen');
      }
    } catch {
      toast.error('Netzwerkfehler');
    } finally {
      setSaving(false);
    }
  };

  if (loading || groups.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-primary" />
              Trainer-Vertretungen
            </CardTitle>
            <CardDescription>
              Weisen Sie einem Trainer eine Gruppe für bestimmte Wochen zu (z.B. Urlaub).
            </CardDescription>
          </div>
          {substitutes.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {substitutes.length}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {substitutes.length > 0 && (
          <div className="space-y-2 rounded-lg border border-border divide-y">
            {substitutes.map((s) => (
              <div key={s.groupId} className="p-3 flex items-center justify-between">
                <div className="text-sm">
                  <p className="font-medium text-foreground">{s.groupName}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.substituteTrainerName} · Woche {s.fromWeek}–{s.toWeek}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-error-500 hover:text-error-700 hover:bg-error-50 h-8 w-8 p-0"
                  onClick={() => handleRemove(s.groupId)}
                  disabled={saving}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {substitutes.length === 0 && !showForm && (
          <div className="text-center py-6 text-muted-foreground text-sm">
            Keine Vertretungen konfiguriert.
          </div>
        )}

        {showForm && (
          <div className="space-y-3 p-4 rounded-lg bg-muted/30 border border-border">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Gruppe</Label>
                <Select value={formGroupId} onValueChange={setFormGroupId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Wähle Gruppe..." />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.groupId} value={g.groupId}>
                        {g.groupName} ({g.trainerName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Von Woche</Label>
                <Input
                  type="number"
                  min="1"
                  max="52"
                  value={formFromWeek}
                  onChange={(e) => setFormFromWeek(e.target.value)}
                  className="h-9"
                />
              </div>

              <div>
                <Label className="text-xs">Bis Woche</Label>
                <Input
                  type="number"
                  min="1"
                  max="52"
                  value={formToWeek}
                  onChange={(e) => setFormToWeek(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="col-span-2">
                <Label className="text-xs">Vertretungs-Trainer</Label>
                <Select value={formTrainerId} onValueChange={setFormTrainerId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Wähle Trainer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {trainers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={handleAdd} disabled={saving} className="flex-1">
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Plus className="h-3.5 w-3.5 mr-1" />
                )}
                Hinzufügen
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowForm(false)}
                disabled={saving}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        )}

        {!showForm && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowForm(true)}
            className="w-full gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Vertretung hinzufügen
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

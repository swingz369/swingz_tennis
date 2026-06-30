'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';
import { UtensilsCrossed, ChevronDown, ChevronUp } from 'lucide-react';
import type { MatchCatering, CateringStatus } from '@/lib/types/catering';
import { CATERING_STATUSES, STATUS_LABELS } from '@/lib/types/catering';

interface MatchDay {
  id: string;
  matchday_number: number;
  scheduled_date: string | null;
  opponent: string;
  is_home: boolean;
}

const STATUS_VARIANT: Record<CateringStatus, 'secondary' | 'warning' | 'success'> = {
  not_planned: 'secondary',
  planned: 'warning',
  ready: 'success',
};

export function CateringTab({ leagueId, matchDays }: { leagueId: string; matchDays: MatchDay[] }) {
  const homeGames = matchDays.filter((m) => m.is_home);
  const [caterings, setCaterings] = useState<Record<string, MatchCatering>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [form, setForm] = useState<
    Record<string, { organizer_name: string; expected_guests: string; notes: string }>
  >({});

  const load = useCallback(async () => {
    const r = await apiFetch(`/api/leagues/${leagueId}/caterings`);
    const body = (await r.json()) as { caterings?: MatchCatering[] };
    if (body.caterings) {
      const map: Record<string, MatchCatering> = {};
      for (const c of body.caterings) map[c.match_day_id] = c;
      setCaterings(map);
    }
  }, [leagueId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function ensureCatering(matchDayId: string): Promise<MatchCatering | null> {
    if (caterings[matchDayId]) return caterings[matchDayId];
    try {
      const r = await apiFetch(`/api/leagues/${leagueId}/caterings`, {
        method: 'POST',
        body: JSON.stringify({ match_day_id: matchDayId }),
      });
      const body = (await r.json()) as { catering?: MatchCatering };
      if (body.catering) {
        setCaterings((prev) => ({ ...prev, [matchDayId]: body.catering! }));
        return body.catering;
      }
    } catch {
      toast.error('Fehler beim Erstellen des Bewirtungseintrags');
    }
    return null;
  }

  async function updateStatus(matchDayId: string, status: CateringStatus) {
    const catering = await ensureCatering(matchDayId);
    if (!catering) return;
    setSaving(matchDayId);
    try {
      const r = await apiFetch(`/api/leagues/${leagueId}/caterings/${catering.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      const body = (await r.json()) as { catering?: MatchCatering };
      if (body.catering) {
        setCaterings((prev) => ({ ...prev, [matchDayId]: body.catering! }));
        toast.success('Status aktualisiert');
      }
    } catch {
      toast.error('Fehler beim Aktualisieren');
    } finally {
      setSaving(null);
    }
  }

  async function saveDetails(matchDayId: string) {
    const catering = await ensureCatering(matchDayId);
    if (!catering) return;
    setSaving(matchDayId);
    const f = form[matchDayId] ?? { organizer_name: '', expected_guests: '', notes: '' };
    try {
      const r = await apiFetch(`/api/leagues/${leagueId}/caterings/${catering.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          organizer_name: f.organizer_name || null,
          expected_guests: f.expected_guests ? parseInt(f.expected_guests, 10) : null,
          notes: f.notes || null,
        }),
      });
      const body = (await r.json()) as { catering?: MatchCatering };
      if (body.catering) {
        setCaterings((prev) => ({ ...prev, [matchDayId]: body.catering! }));
        toast.success('Details gespeichert');
        setExpanded(null);
      }
    } catch {
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(null);
    }
  }

  function toggleExpand(matchDayId: string) {
    if (expanded === matchDayId) {
      setExpanded(null);
      return;
    }
    const c = caterings[matchDayId];
    setForm((prev) => ({
      ...prev,
      [matchDayId]: {
        organizer_name: c?.organizer_name ?? '',
        expected_guests: c?.expected_guests?.toString() ?? '',
        notes: c?.notes ?? '',
      },
    }));
    setExpanded(matchDayId);
  }

  if (homeGames.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Keine Heimspiele in dieser Runde.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {homeGames.map((m) => {
        const c = caterings[m.id];
        const status: CateringStatus = c?.status ?? 'not_planned';
        const isExpanded = expanded === m.id;
        const isSaving = saving === m.id;

        return (
          <Card key={m.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>
                    Spieltag {m.matchday_number} — Heim vs. {m.opponent}
                  </span>
                  {m.scheduled_date && (
                    <span className="text-xs text-muted-foreground font-normal">
                      ({new Date(m.scheduled_date).toLocaleDateString('de-DE')})
                    </span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => toggleExpand(m.id)}
                    title="Details bearbeiten"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0 space-y-4">
                <div className="flex gap-2 flex-wrap">
                  {CATERING_STATUSES.map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={status === s ? 'default' : 'outline'}
                      disabled={isSaving}
                      onClick={() => void updateStatus(m.id, s)}
                    >
                      {STATUS_LABELS[s]}
                    </Button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor={`org-${m.id}`} className="text-xs text-muted-foreground">
                      Verantwortliche Person
                    </label>
                    <Input
                      id={`org-${m.id}`}
                      placeholder="Name"
                      value={form[m.id]?.organizer_name ?? ''}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          [m.id]: {
                            ...(prev[m.id] ?? {
                              organizer_name: '',
                              expected_guests: '',
                              notes: '',
                            }),
                            organizer_name: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor={`guests-${m.id}`} className="text-xs text-muted-foreground">
                      Erwartete Gäste
                    </label>
                    <Input
                      id={`guests-${m.id}`}
                      type="number"
                      min={0}
                      placeholder="Anzahl"
                      value={form[m.id]?.expected_guests ?? ''}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          [m.id]: {
                            ...(prev[m.id] ?? {
                              organizer_name: '',
                              expected_guests: '',
                              notes: '',
                            }),
                            expected_guests: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label htmlFor={`notes-${m.id}`} className="text-xs text-muted-foreground">
                    Notizen
                  </label>
                  <Textarea
                    id={`notes-${m.id}`}
                    placeholder="z.B. Grillwurst + Kaffee, Getränke im Kühlschrank..."
                    rows={2}
                    value={form[m.id]?.notes ?? ''}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        [m.id]: {
                          ...(prev[m.id] ?? { organizer_name: '', expected_guests: '', notes: '' }),
                          notes: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <Button size="sm" disabled={isSaving} onClick={() => void saveDetails(m.id)}>
                  Speichern
                </Button>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

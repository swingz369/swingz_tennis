'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sparkles, Save, Loader2, Calendar, Zap, Info, History } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

// ═══ Types ═══
type Season = {
  id: string;
  name: string;
  season_type: string;
  year: number;
  start_date: string;
  end_date: string;
  planning_status?: string;
};

type PlanningConfig = {
  id?: string;
  club_id?: string;
  season_id?: string;
  treat_high_failure_as_hard?: boolean;
  backtrack_depth?: number;
  max_niveau_span_beginner_months?: number;
  max_niveau_span_advanced_months?: number;
  trainer_utilization_max_pct?: number;
  group_max_size?: number;
  group_min_size?: number;
  slot_failure_rate_threshold_pct?: number;
  slot_duration_minutes?: number;
};

const DEFAULTS: Required<Pick<PlanningConfig, 'treat_high_failure_as_hard' | 'backtrack_depth'>> = {
  treat_high_failure_as_hard: false,
  backtrack_depth: 0,
};

export function SeasonPlanningTab() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [config, setConfig] = useState<PlanningConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  // ── Step 1: Load seasons list for the current club ────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/seasons');
        if (!res.ok) {
          console.warn('Failed to fetch seasons:', await res.text());
          if (!cancelled) setSeasons([]);
          return;
        }
        const data = await res.json();
        const list: Season[] = data.seasons ?? data ?? [];
        if (cancelled) return;
        setSeasons(list);
        // Default-select the first season that is in "planning" or "draft" state,
        // otherwise the most recently created one.
        const preferred = list.find(
          (s) => s.planning_status === 'planning' || s.planning_status === 'draft'
        );
        setSelectedSeasonId(preferred?.id ?? list[0]?.id ?? '');
      } catch (err) {
        console.error('Failed to load seasons:', err);
        toast.error('Fehler beim Laden der Saisons');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Step 2: Load config for the selected season ───────────────────────
  const fetchConfig = useCallback(async (seasonId: string) => {
    if (!seasonId) {
      setConfig(DEFAULTS);
      setConfigLoaded(true);
      return;
    }
    setConfigLoaded(false);
    try {
      const res = await apiFetch(`/api/seasons/${seasonId}/planning/config`, {});
      if (!res.ok) {
        // 404 / 500 → fall back to defaults so the UI still renders
        console.warn('Config fetch failed, using defaults:', await res.text());
        setConfig(DEFAULTS);
        return;
      }
      const data = await res.json();
      const cfg: PlanningConfig = data.config ?? {};
      setConfig({
        ...DEFAULTS,
        ...cfg,
        // Force sane defaults for the two new fields even if the row is partially populated
        treat_high_failure_as_hard:
          cfg.treat_high_failure_as_hard ?? DEFAULTS.treat_high_failure_as_hard,
        backtrack_depth: cfg.backtrack_depth ?? DEFAULTS.backtrack_depth,
      });
    } catch (err) {
      console.error('Failed to fetch config:', err);
      setConfig(DEFAULTS);
    } finally {
      setConfigLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (selectedSeasonId) {
      fetchConfig(selectedSeasonId);
    }
  }, [selectedSeasonId, fetchConfig]);

  // ── Step 3: Save handler ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedSeasonId) {
      toast.error('Bitte zuerst eine Saison auswählen');
      return;
    }
    // Clamp on the client as a UX nicety (server also clamps)
    const depth = Math.max(0, Math.min(10, Number(config.backtrack_depth ?? 0)));
    setSaving(true);
    try {
      const res = await apiFetch(`/api/seasons/${selectedSeasonId}/planning/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          treat_high_failure_as_hard: !!config.treat_high_failure_as_hard,
          backtrack_depth: depth,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig({ ...config, ...data.config });
        toast.success('Planungseinstellungen gespeichert');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? 'Fehler beim Speichern');
      }
    } catch (err) {
      console.error('Failed to save config:', err);
      toast.error('Netzwerkfehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary" />
      </div>
    );
  }

  if (seasons.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-primary" />
            Saisonplanung — Erweiterte Einstellungen
          </CardTitle>
          <CardDescription>
            Keine Saisons vorhanden. Lege zuerst eine Saison an, um die Planungseinstellungen zu
            konfigurieren.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-primary" />
          Saisonplanung — Erweiterte Einstellungen
        </CardTitle>
        <CardDescription>
          Konfiguriere das Backtracking-Verhalten und die Behandlung hochriskanter Zeitslots für die
          KI-gestützte Saisonplanung.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Season selector */}
        <div className="max-w-md">
          <Label htmlFor="season-select" className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Saison
          </Label>
          <Select value={selectedSeasonId} onValueChange={(value) => setSelectedSeasonId(value)}>
            <SelectTrigger id="season-select" className="mt-1.5">
              <SelectValue placeholder="Saison auswählen" />
            </SelectTrigger>
            <SelectContent>
              {seasons.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <div className="flex items-center gap-2">
                    <span>{s.name}</span>
                    {s.planning_status && (
                      <Badge variant="outline" className="text-[10px]">
                        {s.planning_status}
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Settings fields — disabled until config is loaded */}
        <fieldset
          disabled={!configLoaded}
          className="space-y-5 border-t pt-5 not-disabled:cursor-auto"
        >
          {/* Switch: treat_high_failure_as_hard */}
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="treat-high-failure-as-hard"
                  className="text-sm font-medium text-foreground cursor-pointer"
                >
                  Hochrisiko-Zeitslots als harte Constraint
                </Label>
                <Badge variant="secondary" className="text-[10px]">
                  Optimierung #5
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Wenn aktiviert, werden Zeitslots mit einer Ausfallrate über dem Schwellwert{' '}
                <strong>komplett übersprungen</strong> (statt nur mit -50 Score bestraft). Nützlich
                für Vereine, die konsistente Anwesenheit priorisieren.
              </p>
              <p className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                <Info className="h-3 w-3" />
                Standard: <code className="px-1 rounded bg-muted">false</code> (Soft-Score für
                Abwärtskompatibilität)
              </p>
            </div>
            <Switch
              id="treat-high-failure-as-hard"
              checked={!!config.treat_high_failure_as_hard}
              onCheckedChange={(checked) =>
                setConfig({ ...config, treat_high_failure_as_hard: checked })
              }
              aria-label="Hochrisiko-Zeitslots als harte Constraint behandeln"
            />
          </div>

          {/* Number-Input: backtrack_depth */}
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="backtrack-depth"
                  className="text-sm font-medium text-foreground cursor-pointer"
                >
                  Backtracking-Tiefe
                </Label>
                <Badge variant="secondary" className="text-[10px]">
                  Optimierung #6
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Anzahl der Retries, die der Clustering-Algorithmus nach Phase 5 durchführt, um
                unzugewiesene Mitglieder doch noch zu platzieren. Depth-First: die letzten N Gruppen
                werden rückgängig gemacht und mit alternativen Slots re-evaluiert.
              </p>
              <p className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                <Info className="h-3 w-3" />
                Standard: <code className="px-1 rounded bg-muted">0</code> (Greedy ohne
                Backtracking) · Max: 3 Retries intern (höhere Werte werden auf 3 gekappt)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="backtrack-depth"
                type="number"
                min={0}
                max={10}
                step={1}
                value={config.backtrack_depth ?? 0}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(10, parseInt(e.target.value) || 0));
                  setConfig({ ...config, backtrack_depth: val });
                }}
                className="w-20 text-center"
                aria-label="Backtracking-Tiefe (0 = deaktiviert, max 3 Retries intern)"
              />
              <History className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Save button */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Zap className="h-3 w-3 text-amber-500" />
              Änderungen wirken sich auf das nächste Clustering aus.
            </p>
            <Button onClick={handleSave} disabled={saving || !configLoaded} className="gap-2">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Speichern
                </>
              )}
            </Button>
          </div>
        </fieldset>
      </CardContent>
    </Card>
  );
}

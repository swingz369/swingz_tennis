'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWizard } from '@/lib/season-planning/wizard-context';
import { AlertTriangle, Loader2, Calendar } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';

interface InactiveWeekRecord {
  groupId: string;
  weekNumber: number;
  isActive: boolean;
}

const TOTAL_WEEKS = 26;

export function InactiveWeeksPanel() {
  const { state } = useWizard();
  const [weeks, setWeeks] = useState<InactiveWeekRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  const groups = state.clusteringResult?.groups ?? [];

  useEffect(() => {
    if (groups.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    apiFetch(`/api/seasons/${state.seasonId}/planning/inactive-weeks`)
      .then((r) => r.json())
      .then((data) => {
        const weekList: InactiveWeekRecord[] = [];
        for (const g of groups) {
          for (let w = 1; w <= TOTAL_WEEKS; w++) {
            weekList.push({ groupId: g.groupId, weekNumber: w, isActive: true });
          }
        }
        if (Array.isArray(data.weeks)) {
          for (const fetched of data.weeks) {
            const idx = weekList.findIndex(
              (w) => w.groupId === fetched.group_id && w.weekNumber === fetched.week_number
            );
            if (idx >= 0) weekList[idx].isActive = fetched.is_active;
          }
        }
        setWeeks(weekList);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-fetch when group set actually changes (length comparison would re-run on every render)
  }, [state.seasonId, groups.length]);

  const handleToggle = useCallback((groupId: string, weekNumber: number) => {
    setWeeks((prev) =>
      prev.map((w) =>
        w.groupId === groupId && w.weekNumber === weekNumber ? { ...w, isActive: !w.isActive } : w
      )
    );
    setChanged(true);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/seasons/${state.seasonId}/planning/inactive-weeks`, {
        method: 'POST',
        body: JSON.stringify({ weeks }),
      });
      if (res.ok) {
        toast.success('Inaktive Wochen gespeichert');
        setChanged(false);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(extractErrorMessage(err) || 'Fehler beim Speichern');
      }
    } catch {
      toast.error('Netzwerkfehler');
    } finally {
      setSaving(false);
    }
  };

  if (loading || groups.length === 0) return null;

  const groupIds = [...new Set(weeks.map((w) => w.groupId))];
  const inactiveCount = weeks.filter((w) => !w.isActive).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Inaktive Wochen pro Gruppe
            </CardTitle>
            <CardDescription>
              z.B. Hallensanierung, Feiertage. Sessions in diesen Wochen werden nicht erstellt.
            </CardDescription>
          </div>
          {inactiveCount > 0 && (
            <span className="text-xs bg-warning-100 text-warning-700 px-2 py-1 rounded-full">
              {inactiveCount} markiert
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 max-h-96 overflow-y-auto rounded-xl border border-border">
          {groupIds.map((groupId) => {
            const groupWeeks = weeks.filter((w) => w.groupId === groupId);
            const groupName = groups.find((g) => g.groupId === groupId)?.groupName ?? groupId;
            const groupInactive = groupWeeks.filter((w) => !w.isActive).length;

            return (
              <details
                key={groupId}
                className="group rounded-xl border border-muted bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <summary className="cursor-pointer px-4 py-2.5 font-medium text-sm flex items-center justify-between">
                  <span>
                    {groupName}
                    {groupInactive > 0 && (
                      <span className="ml-2 text-xs text-warning-600">
                        ({groupInactive} inaktiv)
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>
                <div className="px-4 pb-3 pt-1 border-t border-muted space-y-1">
                  <div className="grid grid-cols-6 gap-1">
                    {groupWeeks.map((w) => (
                      <label
                        key={`${groupId}-${w.weekNumber}`}
                        className={`flex items-center justify-center p-1 rounded text-xs cursor-pointer transition-colors ${
                          !w.isActive
                            ? 'bg-warning-100 text-warning-700 font-medium'
                            : 'bg-success-50 text-success-700 hover:bg-success-100'
                        }`}
                        title={`Woche ${w.weekNumber}`}
                      >
                        <span className="sr-only">Woche {w.weekNumber}</span>
                        <input
                          type="checkbox"
                          checked={w.isActive}
                          onChange={() => handleToggle(groupId, w.weekNumber)}
                          className="h-3 w-3"
                        />
                      </label>
                    ))}
                  </div>
                  <p className="text-2xs text-muted-foreground mt-2">
                    Grün = aktiv · Gelb = inaktiv. Klicke zum Umschalten.
                  </p>
                </div>
              </details>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t">
          {changed && (
            <div className="flex items-center gap-2 text-sm text-warning-600 flex-1">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              Änderungen müssen gespeichert werden
            </div>
          )}
          <Button size="sm" onClick={handleSave} disabled={!changed || saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Speichern
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

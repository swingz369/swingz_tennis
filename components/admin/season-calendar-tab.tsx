'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SeasonCalendarView } from '@/lib/season-planning/season-calendar-view';
import type { SeasonCalendarData } from '@/lib/season-planning/season-calendar.service';
import { apiFetch } from '@/lib/api-fetch';

interface Props {
  seasonId: string;
  clubId: string;
}

export function SeasonCalendarTab({ seasonId, clubId }: Props) {
  const [data, setData] = useState<SeasonCalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await apiFetch(`/api/seasons/${seasonId}/calendar`);
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(extractErrorMessage(err) ?? `HTTP ${res.status}`);
        }
        const json = (await res.json()) as { ok: boolean; data: SeasonCalendarData };
        if (!cancelled) {
          setData(json.data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [seasonId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-3 text-sm text-muted-foreground">Lade Saisonkalender…</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="space-y-3 py-8 text-center">
          <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
          <p className="text-sm text-muted-foreground">
            {error ?? 'Kalender konnte nicht geladen werden'}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setError(null);
              setLoading(true);
              // Trigger a re-render that re-runs the effect
              setData(null);
            }}
          >
            Erneut versuchen
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <SeasonCalendarView seasonId={seasonId} clubId={clubId} initialData={data} />;
}

export default SeasonCalendarTab;

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sun, Plus, X, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';
import {
  CourtClosureFormDialog,
  type ClosureCourtOption,
} from '@/components/admin/court-closure-form-dialog';

interface Closure {
  id: string;
  court_id: string;
  reason: string;
  weather_condition: string | null;
  start_date: string;
  end_date: string | null;
  description: string | null;
  auto_generated: boolean;
  courts?: { name: string; surface: string };
}

const REASON_LABEL: Record<string, string> = {
  weather: '🌧️ Wetter',
  maintenance: '🔧 Wartung',
  tournament: '🏆 Vereinsturnier',
  event: '📅 Veranstaltung',
};

/**
 * Platzsperren-Verwaltung — immer sichtbar in der Platzverwaltung, unabhängig
 * vom (optionalen) Wetter-Feature. Nutzt dieselbe court_closures-API wie zuvor.
 */
export function ClosuresManager({ courts }: { courts: ClosureCourtOption[] }) {
  const [closures, setClosures] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/weather/closures?active=true');
      if (res.ok) {
        const data = await res.json();
        setClosures(data.closures ?? []);
      }
    } catch {
      toast.error('Fehler beim Laden der Platzsperren');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRemove = async (id: string) => {
    try {
      await apiFetch(`/api/weather/closures/${id}`, { method: 'DELETE' });
      toast.success('Platzsperre aufgehoben');
      fetchData();
    } catch {
      toast.error('Fehler beim Aufheben');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Aktive Platzsperren</CardTitle>
        <Button size="sm" onClick={() => setShowDialog(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Platz sperren
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : closures.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Sun className="h-8 w-8 mx-auto mb-2 text-success-400" />
            <p>Keine aktiven Platzsperren</p>
          </div>
        ) : (
          <div className="space-y-2">
            {closures.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-3 rounded-xl bg-muted border"
              >
                <div>
                  <div className="font-medium text-sm">{c.courts?.name ?? 'Platz'}</div>
                  <div className="text-xs text-muted-foreground">
                    {REASON_LABEL[c.reason] ?? `📋 ${c.reason}`}
                    {c.weather_condition && ` · ${c.weather_condition}`}
                    {c.description && ` · ${c.description}`}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(c.start_date).toLocaleDateString('de-DE')}
                    {c.end_date && ` — ${new Date(c.end_date).toLocaleDateString('de-DE')}`}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(c.id)}
                  aria-label="Sperre aufheben"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <CourtClosureFormDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        courts={courts}
        onCreated={fetchData}
      />
    </Card>
  );
}

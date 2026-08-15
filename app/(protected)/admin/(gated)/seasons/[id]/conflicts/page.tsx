'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, AlertCircle, Info, Clock, RefreshCw, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import type { ConflictDetectionResult } from '@/lib/season-planning/types';
import { PageHeader } from '@/components/ui/page-header';
import { ConflictList } from '@/components/season-planning/conflict-list';
import { conflictFixTarget } from '@/lib/season-planning/conflict-utils';

interface ConflictsData {
  conflicts: ConflictDetectionResult[];
  summary: { critical: number; warnings: number; info: number; total: number };
}

const SUMMARY_CARDS = [
  { key: 'critical', label: 'Kritisch', icon: AlertTriangle, color: 'text-error-600' },
  { key: 'warning', label: 'Warnung', icon: AlertCircle, color: 'text-warning-600' },
  { key: 'info', label: 'Info', icon: Info, color: 'text-info-600' },
] as const;

export default function ConflictsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: seasonId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<ConflictsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchConflicts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/seasons/${seasonId}/planning/conflicts`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(err) || 'Fehler beim Laden der Konflikte');
      }
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    fetchConflicts();
  }, [fetchConflicts]);

  // Von hier aus führt "Beheben" in den Planungs-Wizard — die Ursache lässt
  // sich nur dort abstellen, nicht auf dieser Übersichtsseite.
  const handleFix = (conflict: ConflictDetectionResult) => {
    const target = conflictFixTarget(conflict.type);
    toast.info(target.hint, { description: conflict.description, duration: 10000 });
    router.push(`/admin/seasons/${seasonId}/planning`);
  };

  const handleAction = async (conflictId: string, action: 'ignore') => {
    setResolvingId(conflictId);
    try {
      const res = await apiFetch(`/api/seasons/${seasonId}/planning/conflicts`, {
        method: 'PATCH',
        body: JSON.stringify({ conflictId, action, notes: 'Bewusst ignoriert' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(extractErrorMessage(err) || 'Fehler beim Aktualisieren');
        return;
      }
      toast.success('Konflikt ignoriert');
      // Neu erkennen statt lokal umschreiben — eine Änderung am Plan kann
      // weitere Konflikte auflösen oder erzeugen.
      await fetchConflicts();
    } catch {
      toast.error('Netzwerkfehler');
    } finally {
      setResolvingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/seasons/${seasonId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück zur Saison
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Fehler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={fetchConflicts} className="mt-4" variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { conflicts, summary } = data;
  const open = conflicts.filter((c) => c.status === 'open').length;
  const counts = { critical: summary.critical, warning: summary.warnings, info: summary.info };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/admin/seasons/${seasonId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title="Planungskonflikte"
          description={`${conflicts.length} erkannt — ${open} offen, ${conflicts.length - open} erledigt`}
        />
        <Button variant="outline" size="sm" className="ml-auto" onClick={fetchConflicts}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Neu prüfen
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {SUMMARY_CARDS.map(({ key, label, icon: Icon, color }) => (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{counts[key]}</div>
              <p className="text-xs text-muted-foreground">offen</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <ConflictList
        conflicts={conflicts}
        onFix={handleFix}
        onIgnore={(id) => handleAction(id, 'ignore')}
        resolvingId={resolvingId}
      />
    </div>
  );
}

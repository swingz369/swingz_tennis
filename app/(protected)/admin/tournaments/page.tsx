'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Trophy, Calendar, Users, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconBox } from '@/components/ui/icon-box';

interface Tournament {
  id: string;
  name: string;
  description?: string;
  format: string;
  category: string;
  start_date: string;
  end_date?: string;
  status: string;
  max_participants?: number;
  registration_deadline?: string;
  entry_fee?: number;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf',
  registration: 'Anmeldung',
  active: 'Aktiv',
  completed: 'Abgeschlossen',
  cancelled: 'Abgesagt',
};

const STATUS_VARIANTS: Record<string, string> = {
  draft: 'secondary',
  registration: 'default',
  active: 'default',
  completed: 'secondary',
  cancelled: 'destructive',
};

const FORMAT_LABELS: Record<string, string> = {
  single_elimination: 'K.O.',
  double_elimination: 'Doppel-K.O.',
  round_robin: 'Jeder gegen jeden',
  swiss: 'Schweizer System',
};

export default function AdminTournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/tournaments')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data) => setTournaments(Array.isArray(data) ? data : (data.tournaments ?? [])))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Turniere</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Turnierverwaltung des Vereins</p>
        </div>
        <Button asChild size="sm" variant="brand" className="gap-1.5">
          <Link href="/admin/tournaments/new">
            <Plus className="h-4 w-4" />
            Neues Turnier
          </Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-700/50 dark:text-red-400">
          Fehler: {error}
        </div>
      )}

      {!loading && tournaments.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <IconBox icon={Trophy} size="lg" variant="amber" className="h-16 w-16" />
          <h3 className="font-semibold">Noch keine Turniere</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Lege dein erstes Turnier an und lade Mitglieder zur Anmeldung ein.
          </p>
          <Button asChild size="sm" variant="brand" className="mt-2">
            <Link href="/admin/tournaments/new">Erstes Turnier anlegen</Link>
          </Button>
        </div>
      )}

      {tournaments.length > 0 && (
        <div className="space-y-3">
          {tournaments.map((t) => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-4">
                <IconBox icon={Trophy} size="md" variant="amber" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">{t.name}</p>
                    <Badge
                      variant={(STATUS_VARIANTS[t.status] as any) ?? 'secondary'}
                      className="text-xs"
                    >
                      {STATUS_LABELS[t.status] ?? t.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(t.start_date).toLocaleDateString('de-DE')}
                      {t.end_date && ` – ${new Date(t.end_date).toLocaleDateString('de-DE')}`}
                    </span>
                    <span>{FORMAT_LABELS[t.format] ?? t.format}</span>
                    {t.max_participants && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        max. {t.max_participants}
                      </span>
                    )}
                    {t.entry_fee && t.entry_fee > 0 && <span>€{t.entry_fee}</span>}
                  </div>
                </div>
                <Link
                  href={`/admin/tournaments/${t.id}`}
                  className="text-xs text-brand-light hover:underline shrink-0"
                >
                  Details →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

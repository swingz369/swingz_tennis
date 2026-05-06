'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, Users, AlertCircle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import type { SeasonWithStats } from '@/lib/types/season-planning';

export default function SeasonsPage() {
  const router = useRouter();
  const [seasons, setSeasons] = useState<SeasonWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSeasons();
  }, []);

  const fetchSeasons = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/seasons');

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Seasons');
      }

      const data = await response.json();
      setSeasons(data.seasons || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
    > = {
      draft: { label: 'Entwurf', variant: 'secondary' },
      collecting_preferences: { label: 'Sammelt Präferenzen', variant: 'outline' },
      auto_planning: { label: 'Automatische Planung', variant: 'default' },
      manual_review: { label: 'Manuelle Überprüfung', variant: 'outline' },
      published: { label: 'Veröffentlicht', variant: 'default' },
      active: { label: 'Aktiv', variant: 'default' },
      completed: { label: 'Abgeschlossen', variant: 'secondary' },
      archived: { label: 'Archiviert', variant: 'secondary' },
    };

    const config = statusConfig[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getSeasonIcon = (type: string) => {
    return type === 'summer' ? '☀️' : '❄️';
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <Clock className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Lade Seasons...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <CardTitle>Fehler</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={fetchSeasons} className="mt-4" variant="outline">
            Erneut versuchen
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Saisonplanung</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre Trainings-Seasons und Planungen
          </p>
        </div>
        <Button onClick={() => router.push('/admin/seasons/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Neue Season
        </Button>
      </div>

      {/* Stats Overview */}
      {seasons.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Seasons Gesamt</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{seasons.length}</div>
              <p className="text-xs text-muted-foreground">
                {seasons.filter((s) => s.is_active).length} aktiv
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Präferenzen</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {seasons.reduce((sum, s) => sum + s.submitted_preferences, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Eingereicht</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Geplante Einheiten</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {seasons.reduce((sum, s) => sum + s.planned_entries, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Training-Sessions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Offene Konflikte</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {seasons.reduce((sum, s) => sum + s.open_conflicts, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Zu lösen</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Seasons List */}
      {seasons.length === 0 ? (
        <Card className="flex h-96 flex-col items-center justify-center">
          <CardHeader>
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
            <CardTitle className="text-center">Keine Seasons vorhanden</CardTitle>
            <CardDescription className="text-center">
              Erstellen Sie Ihre erste Season, um mit der Planung zu beginnen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/admin/seasons/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Erste Season erstellen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {seasons.map((season) => (
            <Card
              key={season.id}
              className="cursor-pointer transition-shadow hover:shadow-lg"
              onClick={() => router.push(`/admin/seasons/${season.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getSeasonIcon(season.season_type)}</span>
                    <div>
                      <CardTitle className="text-lg">{season.name}</CardTitle>
                      <CardDescription>
                        {new Date(season.start_date).toLocaleDateString('de-DE')} -{' '}
                        {new Date(season.end_date).toLocaleDateString('de-DE')}
                      </CardDescription>
                    </div>
                  </div>
                  {season.is_active && (
                    <Badge variant="default" className="ml-2">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Aktiv
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status:</span>
                  {getStatusBadge(season.planning_status)}
                </div>

                <div className="space-y-2 border-t pt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Präferenzen:</span>
                    <span className="font-medium">
                      {season.submitted_preferences} / {season.total_preferences}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Trainer:</span>
                    <span className="font-medium">{season.trainers_count}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Geplante Einheiten:</span>
                    <span className="font-medium">{season.planned_entries}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Gruppen:</span>
                    <span className="font-medium">{season.groups_covered}</span>
                  </div>
                </div>

                {season.open_conflicts > 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-destructive">
                      {season.open_conflicts} offene Konflikte
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

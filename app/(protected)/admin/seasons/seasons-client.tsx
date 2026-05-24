'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Calendar,
  Users,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  CalendarPlus,
} from 'lucide-react';
import type { SeasonWithStats } from '@/lib/types/season-planning';

interface SeasonsClientProps {
  initialSeasons: SeasonWithStats[];
}

export function SeasonsClient({ initialSeasons }: SeasonsClientProps) {
  const router = useRouter();
  const seasons = initialSeasons;

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { label: string; variant: 'default' | 'secondary' | 'error' | 'outline' }
    > = {
      draft: { label: 'Entwurf', variant: 'secondary' },
      collecting_preferences: { label: 'Sammelt Präferenzen', variant: 'outline' },
      auto_planning: { label: 'Automatische Planung', variant: 'default' },
      manual_review: { label: 'Manuelle Überprüfung', variant: 'outline' },
      finalized: { label: 'Finalisiert', variant: 'default' },
      completed: { label: 'Abgeschlossen', variant: 'secondary' },
      archived: { label: 'Archiviert', variant: 'secondary' },
    };

    const config = statusConfig[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getSeasonIcon = (type: string) => {
    return type === 'summer' ? '☀️' : '❄️';
  };

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
                {seasons.reduce((sum, s) => sum + (Number(s.submitted_preferences) || 0), 0)}
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
                {seasons.reduce((sum, s) => sum + (Number(s.planned_entries) || 0), 0)}
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
                {seasons.reduce((sum, s) => sum + (Number(s.open_conflicts) || 0), 0)}
              </div>
              <p className="text-xs text-muted-foreground">Zu lösen</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Seasons List */}
      {seasons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-light/10 mb-5">
            <CalendarPlus className="h-10 w-10 text-brand-light" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            Noch keine Spielzeit
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-xs">
            Erstelle deine erste Spielzeit um die Trainingsplanung zu starten
          </p>
          <Button
            onClick={() => router.push('/admin/seasons/new')}
            variant="brand"
            className="mt-6 gap-2 px-6 py-2.5 h-auto rounded-xl font-medium"
          >
            <Plus className="h-4 w-4" />
            Spielzeit erstellen
          </Button>
        </div>
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

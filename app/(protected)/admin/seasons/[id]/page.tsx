'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Calendar,
  Users,
  AlertCircle,
  TrendingUp,
  Play,
  Settings,
  FileText,
  Clock,
  CheckCircle,
} from 'lucide-react';
import type { SeasonWithStats } from '@/lib/types/season-planning';

interface SeasonDetailPageProps {
  params: {
    id: string;
  };
}

export default function SeasonDetailPage({ params }: SeasonDetailPageProps) {
  const router = useRouter();
  const [season, setSeason] = useState<SeasonWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSeason();
  }, [params.id]);

  const fetchSeason = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/seasons/${params.id}`);

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Season');
      }

      const data = await response.json();
      setSeason(data.season);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPreferences = async () => {
    try {
      const response = await fetch(`/api/seasons/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planning_status: 'collecting_preferences',
          preferences_open: true,
        }),
      });

      if (!response.ok) throw new Error('Fehler beim Öffnen der Präferenzen');

      await fetchSeason();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const handleStartAutoPlanning = async () => {
    if (!confirm('Möchten Sie die automatische Planung starten?')) return;

    try {
      router.push(`/admin/seasons/${params.id}/auto-plan`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const handlePublish = async () => {
    if (!confirm('Möchten Sie diese Season veröffentlichen?')) return;

    try {
      const response = await fetch(`/api/seasons/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planning_status: 'published' }),
      });

      if (!response.ok) throw new Error('Fehler beim Veröffentlichen');

      await fetchSeason();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !season) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <CardTitle>Fehler</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error || 'Season nicht gefunden'}</p>
          <Button onClick={() => router.push('/admin/seasons')} className="mt-4" variant="outline">
            Zurück zur Übersicht
          </Button>
        </CardContent>
      </Card>
    );
  }

  const canOpenPreferences = season.planning_status === 'draft';
  const canStartAutoPlanning =
    season.planning_status === 'collecting_preferences' ||
    season.planning_status === 'manual_review';
  const canPublish = season.planning_status === 'manual_review';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin/seasons')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{season.season_type === 'summer' ? '☀️' : '❄️'}</span>
              <h1 className="text-3xl font-bold tracking-tight">{season.name}</h1>
              {season.is_active && (
                <Badge variant="default">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Aktiv
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {new Date(season.start_date).toLocaleDateString('de-DE')} -{' '}
              {new Date(season.end_date).toLocaleDateString('de-DE')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push(`/admin/seasons/${params.id}/edit`)}>
            <Settings className="mr-2 h-4 w-4" />
            Bearbeiten
          </Button>

          {canOpenPreferences && (
            <Button onClick={handleOpenPreferences}>
              <Users className="mr-2 h-4 w-4" />
              Präferenzen öffnen
            </Button>
          )}

          {canStartAutoPlanning && (
            <Button onClick={handleStartAutoPlanning}>
              <Play className="mr-2 h-4 w-4" />
              Auto-Planung starten
            </Button>
          )}

          {canPublish && (
            <Button onClick={handlePublish}>
              <FileText className="mr-2 h-4 w-4" />
              Veröffentlichen
            </Button>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Präferenzen</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{season.submitted_preferences}</div>
            <p className="text-xs text-muted-foreground">
              von {season.total_preferences} eingereicht
            </p>
            <div className="mt-2 h-2 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${season.total_preferences > 0 ? (season.submitted_preferences / season.total_preferences) * 100 : 0}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trainer</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{season.trainers_count}</div>
            <p className="text-xs text-muted-foreground">Trainer verfügbar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Geplante Einheiten</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{season.planned_entries}</div>
            <p className="text-xs text-muted-foreground">Training-Sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Konflikte</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{season.open_conflicts}</div>
            <p className="text-xs text-muted-foreground">
              {season.open_conflicts > 0 ? 'Zu lösen' : 'Keine Konflikte'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="preferences">
            Präferenzen ({season.submitted_preferences})
          </TabsTrigger>
          <TabsTrigger value="plan">Plan ({season.planned_entries})</TabsTrigger>
          <TabsTrigger value="conflicts">Konflikte ({season.open_conflicts})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Season Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <p className="text-lg">{season.planning_status}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Saison-Typ</p>
                  <p className="text-lg capitalize">{season.season_type}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Jahr</p>
                  <p className="text-lg">{season.year}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Gruppen abgedeckt</p>
                  <p className="text-lg">{season.groups_covered}</p>
                </div>
              </div>

              {season.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Beschreibung</p>
                  <p className="mt-1 text-sm">{season.description}</p>
                </div>
              )}

              {season.preferences_deadline && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Präferenz-Deadline</p>
                  <p className="mt-1 text-sm">
                    {new Date(season.preferences_deadline).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>User Präferenzen</CardTitle>
              <CardDescription>
                Übersicht aller eingereichten Verfügbarkeiten und Präferenzen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push(`/admin/seasons/${params.id}/preferences`)}>
                Alle Präferenzen anzeigen
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plan">
          <Card>
            <CardHeader>
              <CardTitle>Trainingsplan</CardTitle>
              <CardDescription>Geplante Training-Sessions für diese Season</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push(`/admin/seasons/${params.id}/plan`)}>
                Plan anzeigen
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conflicts">
          <Card>
            <CardHeader>
              <CardTitle>Planungskonflikte</CardTitle>
              <CardDescription>Erkannte Konflikte in der Planung</CardDescription>
            </CardHeader>
            <CardContent>
              {season.open_conflicts === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500" />
                  <p className="mt-4 text-lg font-medium">Keine Konflikte</p>
                  <p className="text-sm text-muted-foreground">Die Planung ist konfliktfrei</p>
                </div>
              ) : (
                <Button onClick={() => router.push(`/admin/seasons/${params.id}/conflicts`)}>
                  Konflikte anzeigen ({season.open_conflicts})
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

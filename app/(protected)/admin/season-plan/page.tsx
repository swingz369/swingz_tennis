'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { LayoutGrid, Calendar, ArrowRight } from 'lucide-react';
import type { SeasonWithStats } from '@/lib/types/season-planning';

export default function SeasonPlanOverviewPage() {
  const router = useRouter();
  const [seasons, setSeasons] = useState<SeasonWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        const res = await fetch('/api/seasons');
        if (res.ok) {
          const data = await res.json();
          setSeasons(data.seasons || []);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchSeasons();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (seasons.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
        <LayoutGrid className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Keine Saisons vorhanden</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-md">
          Erstelle zuerst eine Saison und führe die Saisonplanung durch, um den Stundenplan zu sehen.
        </p>
        <Button onClick={() => router.push('/admin/seasons/new')} className="mt-6">
          Neue Saison erstellen
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Saison-Stundenplan</h1>
        <p className="text-sm text-muted-foreground">
          Wähle eine Saison aus, um den Wochen-Stundenplan mit farbcodierten Gruppen anzuzeigen
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {seasons.map((season) => (
          <Card
            key={season.id}
            className="cursor-pointer transition-shadow hover:shadow-lg"
            onClick={() => router.push(`/admin/season-plan/${season.id}`)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">
                    {season.season_type === 'summer' ? '☀️' : '❄️'}
                  </span>
                  <div>
                    <CardTitle className="text-lg">{season.name}</CardTitle>
                    <CardDescription>
                      {new Date(season.start_date).toLocaleDateString('de-DE')} -{' '}
                      {new Date(season.end_date).toLocaleDateString('de-DE')}
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>{season.planned_entries} geplante Einheiten</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {season.planning_status === 'published' ? 'Veröffentlicht' :
                     season.planning_status === 'draft' ? 'Entwurf' :
                     season.planning_status === 'active' ? 'Aktiv' :
                     season.planning_status === 'completed' ? 'Abgeschlossen' :
                     season.planning_status}
                  </Badge>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

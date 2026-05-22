'use client';

import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import SeasonPlanGrid from '@/components/season-plan-grid';
import { useSeasonPlanGrid } from '@/hooks/use-season-plan-entries';

interface SeasonPlanGridClientProps {
  seasonId: string;
  seasonName: string;
  clubId: string;
}

export function SeasonPlanGridClient({
  seasonId,
  seasonName,
}: SeasonPlanGridClientProps) {
  const router = useRouter();
  const { data, isLoading, error } = useSeasonPlanGrid(seasonId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/admin/seasons')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Saison-Stundenplan
          </h1>
          <p className="text-sm text-muted-foreground">{seasonName}</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700 font-medium">Fehler beim Laden des Stundenplans</p>
          <p className="text-sm text-red-600 mt-1">
            {error instanceof Error ? error.message : 'Unbekannter Fehler'}
          </p>
        </div>
      ) : (
        <SeasonPlanGrid
          slots={data?.slots ?? []}
          groups={data?.groups ?? []}
          courts={data?.courts ?? []}
          seasonName={seasonName}
          loading={isLoading}
        />
      )}
    </div>
  );
}

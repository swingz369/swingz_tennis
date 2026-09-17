import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-fetch';

interface SeasonInfo {
  id: string;
  is_active: boolean;
  planning_status: string;
}

/** Aktive (oder zuletzt veröffentlichte) Saison des Vereins — Grundlage für
 *  das Saisonplan-Overlay im Kalender (Trainings, Gruppenzuordnung). */
export function useActiveSeasonId(clubId: string | null): string | null {
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);

  useEffect(() => {
    if (!clubId) return;
    const fetchActiveSeason = async () => {
      try {
        const res = await apiFetch(`/api/seasons?clubId=${clubId}`);
        if (res.ok) {
          const responseData = await res.json();
          const seasons: SeasonInfo[] = responseData.seasons ?? [];
          const active = seasons.find(
            (s) => s.is_active && ['published', 'active'].includes(s.planning_status)
          );
          if (active) {
            setActiveSeasonId(active.id);
          } else {
            const latest = seasons.find((s) =>
              ['published', 'active', 'completed'].includes(s.planning_status)
            );
            if (latest) setActiveSeasonId(latest.id);
          }
        }
      } catch {
        /* ignore */
      }
    };
    fetchActiveSeason();
  }, [clubId]);

  return activeSeasonId;
}

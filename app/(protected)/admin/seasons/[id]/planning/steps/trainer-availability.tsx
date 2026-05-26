'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useWizard } from '@/lib/season-planning/wizard-context';
import { Users, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface TrainerAvailabilityData {
  trainerId: string;
  trainerName: string;
  maxHoursPerWeek: number;
  maxUtilizationPct: number;
  currentAssignedHours: number;
  availableSlots: number;
  weeklyDays: string[];
}

export function TrainerAvailabilityPanel() {
  const { state, dispatch } = useWizard();
  const [loading, setLoading] = useState(true);
  const [trainers, setTrainers] = useState<TrainerAvailabilityData[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTrainers() {
      try {
        setLoading(true);
        setError(null);

        // Fetch trainer profiles for the club
        const profilesRes = await fetch('/api/trainer-profiles');
        if (!profilesRes.ok) {
          throw new Error('Failed to load trainer profiles');
        }
        const { profiles } = await profilesRes.json();

        if (!profiles || profiles.length === 0) {
          setTrainers([]);
          setLoading(false);
          return;
        }

        // For each trainer, fetch their availability slots
        const trainerData = await Promise.all(
          profiles.map(async (profile: any) => {
            const availRes = await fetch(`/api/trainer-availability?trainer_id=${profile.userId}`);
            const { availabilities } = availRes.ok ? await availRes.json() : { availabilities: [] };

            const availableSlots = (availabilities || []).filter(
              (a: any) => a.status === 'available'
            );
            const bookedSlots = (availabilities || []).filter((a: any) => a.status === 'booked');

            // Extract weekly days from profile availability
            const weeklyDays = Object.entries(profile.availability || {})
              .filter(([, v]) => v)
              .map(([k]) => k);

            return {
              trainerId: profile.userId,
              trainerName: `${profile.firstName} ${profile.lastName}`,
              maxHoursPerWeek: 30,
              maxUtilizationPct: state.planningConfig.trainerUtilizationMaxPct,
              currentAssignedHours: bookedSlots.length * 1.5, // rough estimate
              availableSlots: availableSlots.length + weeklyDays.length * 2,
              weeklyDays,
            };
          })
        );

        setTrainers(trainerData);

        // Dispatch trainer availability summary to wizard state
        const overallUtilization =
          trainerData.length > 0
            ? trainerData.reduce(
                (s, t) => s + (t.currentAssignedHours / Math.max(1, t.maxHoursPerWeek)) * 100,
                0
              ) / trainerData.length
            : 0;

        dispatch({
          type: 'SET_TRAINER_AVAILABILITY',
          summary: {
            trainers: trainerData.map((t) => ({
              trainerId: t.trainerId,
              trainerName: t.trainerName,
              maxHoursPerWeek: t.maxHoursPerWeek,
              maxUtilizationPct: t.maxUtilizationPct,
              effectiveMaxHours: t.maxHoursPerWeek * (t.maxUtilizationPct / 100),
              currentAssignedHours: t.currentAssignedHours,
              availableSlots: t.availableSlots,
              utilizationStatus:
                t.availableSlots === 0
                  ? ('over' as const)
                  : t.availableSlots < 3
                    ? ('near_limit' as const)
                    : t.availableSlots < 6
                      ? ('optimal' as const)
                      : ('under' as const),
            })),
            overallUtilization: Math.round(overallUtilization),
            burnoutWarnings: trainerData
              .filter((t) => t.availableSlots === 0)
              .map((t) => `${t.trainerName}: Keine Verfügbarkeiten eingetragen`),
          },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      } finally {
        setLoading(false);
      }
    }

    fetchTrainers();
    // Re-fetch when season or planning config changes
  }, [state.seasonId, state.planningConfig.trainerUtilizationMaxPct]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-brand-primary" />
            Trainer-Verfügbarkeiten
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Fehler beim Laden der Trainerdaten: {error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (trainers.length === 0) {
    return (
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-amber-700 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Keine Trainer gefunden. Füge Trainer unter Admin → Trainer hinzu, bevor du die
              Saisonplanung startest.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-primary" />
          Trainer-Verfügbarkeiten ({trainers.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {trainers.map((trainer) => {
            const isWarning = trainer.availableSlots > 0 && trainer.availableSlots < 6;
            const isBad = trainer.availableSlots === 0;

            return (
              <div
                key={trainer.trainerId}
                className={`flex items-center justify-between p-3 rounded-lg border text-sm ${
                  isBad
                    ? 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800'
                    : isWarning
                      ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800'
                      : 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0">
                    {isBad ? (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    ) : isWarning ? (
                      <Clock className="h-4 w-4 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{trainer.trainerName}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                      {trainer.weeklyDays.length > 0 ? (
                        <span>{trainer.weeklyDays.length} Tage/Woche</span>
                      ) : (
                        <span className="text-red-500">Keine Tage</span>
                      )}
                      <span>·</span>
                      <span>{trainer.availableSlots} freie Slots</span>
                    </p>
                  </div>
                </div>
                <Badge
                  variant={isBad ? 'error' : isWarning ? 'warning' : 'success'}
                  size="sm"
                  className="shrink-0"
                >
                  {isBad ? 'Nicht verfügbar' : isWarning ? 'Wenig Slots' : 'Verfügbar'}
                </Badge>
              </div>
            );
          })}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-xs text-gray-500">Gesamt-Trainer</p>
            <p className="text-lg font-bold text-brand-primary">{trainers.length}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">Freie Slots gesamt</p>
            <p className="text-lg font-bold text-brand-primary">
              {trainers.reduce((s, t) => s + t.availableSlots, 0)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// GET /api/seasons/[id]/planning/trainers
// Schritt 3: Trainer availability and load overview

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ApiException, safeErrorMessage } from '@/lib/api-error';
import { withApiAuth } from '@/lib/api-auth';
import { SeasonPlanningService } from '@/application/services/season-planning.service';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import type { TrainerAvailabilitySummary } from '@/lib/season-planning/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:planning:trainers');

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, { max: 30, windowMs: 60000 });
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;
      const {
        trainerPrefs,
        clubTrainers,
        entries: existingEntries,
        config,
      } = await new SeasonPlanningService(auth).trainerOverviewData(seasonId);

      const maxUtilizationPct = config?.trainer_utilization_max_pct || 80;
      const burnoutWarnings: string[] = [];

      const trainerSummaries: Array<{
        trainerId: string;
        trainerName: string;
        maxHoursPerWeek: number;
        maxUtilizationPct: number;
        effectiveMaxHours: number;
        currentAssignedHours: number;
        availableSlots: number;
        utilizationStatus: 'under' | 'optimal' | 'near_limit' | 'over';
        hasSubmittedPreferences: boolean;
      }> = [];
      const processedTrainerIds = new Set<string>();

      // Process submitted trainers first
      trainerPrefs.forEach((tp) => {
        if (!tp.trainer) return;
        processedTrainerIds.add(tp.trainer.id);

        const maxHours = tp.trainer.max_hours_per_week || 30;
        const effectiveMaxHours = maxHours * (maxUtilizationPct / 100);
        const sessionsAssigned = existingEntries.filter(
          (e) => e.trainer_id === tp.pref.user_id
        ).length;
        const hoursAssigned = sessionsAssigned * 1.5; // 90 min sessions
        const availableSlots = Math.max(0, Math.floor(effectiveMaxHours / 1.5) - sessionsAssigned);

        let utilizationStatus: 'under' | 'optimal' | 'near_limit' | 'over';
        const pctUsed = effectiveMaxHours > 0 ? (hoursAssigned / effectiveMaxHours) * 100 : 0;
        if (pctUsed > 100) utilizationStatus = 'over';
        else if (pctUsed > 80) utilizationStatus = 'near_limit';
        else if (pctUsed < 30) utilizationStatus = 'under';
        else utilizationStatus = 'optimal';

        if (utilizationStatus === 'over') {
          burnoutWarnings.push(
            `${tp.user_name || tp.trainer?.name}: ${hoursAssigned.toFixed(1)}h von max ${effectiveMaxHours.toFixed(1)}h (${pctUsed.toFixed(0)}%) – Burnout-Risiko!`
          );
        }

        trainerSummaries.push({
          trainerId: tp.pref.user_id,
          trainerName: tp.user_name || tp.trainer?.name || 'Unbekannt',
          maxHoursPerWeek: maxHours,
          maxUtilizationPct,
          effectiveMaxHours,
          currentAssignedHours: hoursAssigned,
          availableSlots,
          utilizationStatus,
          hasSubmittedPreferences: true,
        });
      });

      // Add unsubmitted trainers from club
      for (const trainer of clubTrainers) {
        if (processedTrainerIds.has(trainer.id)) continue;
        processedTrainerIds.add(trainer.id);

        const maxHours = trainer.max_hours_per_week || 30;
        const effectiveMaxHours = maxHours * (maxUtilizationPct / 100);
        const trainerKey = trainer.user_id || trainer.id;
        const sessionsAssigned = existingEntries.filter((e) => e.trainer_id === trainerKey).length;
        const hoursAssigned = sessionsAssigned * 1.5;
        const availableSlots = Math.max(0, Math.floor(effectiveMaxHours / 1.5) - sessionsAssigned);

        let utilizationStatus: 'under' | 'optimal' | 'near_limit' | 'over';
        const pctUsed = effectiveMaxHours > 0 ? (hoursAssigned / effectiveMaxHours) * 100 : 0;
        if (pctUsed > 100) utilizationStatus = 'over';
        else if (pctUsed > 80) utilizationStatus = 'near_limit';
        else if (pctUsed < 30) utilizationStatus = 'under';
        else utilizationStatus = 'optimal';

        if (utilizationStatus === 'over') {
          burnoutWarnings.push(
            `${trainer.name}: ${hoursAssigned.toFixed(1)}h von max ${effectiveMaxHours.toFixed(1)}h (${pctUsed.toFixed(0)}%) – Burnout-Risiko!`
          );
        }

        trainerSummaries.push({
          trainerId: trainerKey,
          trainerName: trainer.name,
          maxHoursPerWeek: maxHours,
          maxUtilizationPct,
          effectiveMaxHours,
          currentAssignedHours: hoursAssigned,
          availableSlots,
          utilizationStatus,
          hasSubmittedPreferences: false,
        });
      }

      const overallUtilization =
        trainerSummaries.length > 0
          ? trainerSummaries.reduce((sum, t) => {
              const pct =
                t.effectiveMaxHours > 0 ? (t.currentAssignedHours / t.effectiveMaxHours) * 100 : 0;
              return sum + pct;
            }, 0) / trainerSummaries.length
          : 0;

      const summary: TrainerAvailabilitySummary = {
        trainers: trainerSummaries,
        overallUtilization: Math.round(overallUtilization * 100) / 100,
        burnoutWarnings,
      };

      return NextResponse.json({ success: true, summary });
    } catch (error) {
      if (error instanceof ApiException) {
        return NextResponse.json({ error: safeErrorMessage(error) }, { status: error.status });
      }
      log.error('GET trainers error:', error);
      return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
    }
  });
}

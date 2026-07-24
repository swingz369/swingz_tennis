// GET /api/seasons/[id]/planning/trainers
// Schritt 3: Trainer availability and load overview

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { db } from '@/src/infrastructure/persistence/db';
import {
  seasons,
  users,
  trainers as trainersTable,
  trainerClubs,
  userClubMemberships,
  userTrainingPreferences,
  seasonPlanEntries,
} from '@/src/infrastructure/persistence/schema';
import { seasonPlanningConfigs } from '@/src/infrastructure/persistence/season-planning-schema';
import { eq, and } from 'drizzle-orm';
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
      const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
      if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

      const isAdmin = await verifyRole(auth, 'admin');
      const isSuperadmin = await verifyRole(auth, 'superadmin');
      if (!isAdmin && !isSuperadmin) return forbiddenResponse('Nur Admins');

      if (!isSuperadmin) {
        const hasClubAccess = auth.memberships.some(
          (m) => m.club_id === season.club_id && (m.role === 'admin' || m.role === 'superadmin')
        );
        if (!hasClubAccess) return forbiddenResponse('Kein Zugriff auf diesen Club');
      }

      // Get trainer preferences
      const trainerPrefs = await db
        .select({
          pref: userTrainingPreferences,
          trainer: trainersTable,
          user_name: users.full_name,
        })
        .from(userTrainingPreferences)
        .innerJoin(users, eq(userTrainingPreferences.user_id, users.id))
        .innerJoin(trainersTable, eq(users.id, trainersTable.user_id))
        .where(
          and(
            eq(userTrainingPreferences.season_id, seasonId),
            eq(userTrainingPreferences.is_submitted, true),
            eq(userTrainingPreferences.user_role, 'trainer')
          )
        );

      // Get ALL active club trainers (to cover trainers without submitted preferences)
      // Primary source: trainer_clubs join
      let clubTrainers = await db
        .select({ trainer: trainersTable })
        .from(trainersTable)
        .innerJoin(trainerClubs, eq(trainersTable.id, trainerClubs.trainer_id))
        .where(and(eq(trainerClubs.club_id, season.club_id), eq(trainersTable.is_active, true)));

      // Fallback: user_club_memberships with role='trainer' (for clubs that use
      // memberships instead of trainer_clubs)
      if (clubTrainers.length === 0) {
        const membershipTrainers = await db
          .select({ trainer: trainersTable })
          .from(userClubMemberships)
          .innerJoin(trainersTable, eq(userClubMemberships.user_id, trainersTable.user_id))
          .where(
            and(
              eq(userClubMemberships.club_id, season.club_id),
              eq(userClubMemberships.role, 'trainer'),
              eq(userClubMemberships.is_active, true),
              eq(trainersTable.is_active, true)
            )
          );
        clubTrainers = membershipTrainers;
      }

      // Get existing plan entries for utilization calculation
      const existingEntries = await db
        .select()
        .from(seasonPlanEntries)
        .where(eq(seasonPlanEntries.season_id, seasonId));

      // Get config
      const [config] = await db
        .select()
        .from(seasonPlanningConfigs)
        .where(
          and(
            eq(seasonPlanningConfigs.club_id, season.club_id),
            eq(seasonPlanningConfigs.season_id, seasonId)
          )
        );

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
      for (const { trainer } of clubTrainers) {
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
      log.error('GET trainers error:', error);
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  });
}

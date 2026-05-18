// GET /api/seasons/[id]/planning/trainers
// Schritt 3: Trainer availability and load overview

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { getDb } from '@/src/infrastructure/persistence/client';
import { seasons, users, trainers as trainersTable, userTrainingPreferences, seasonPlanEntries } from '@/src/infrastructure/persistence/schema';
import { seasonPlanningConfigs } from '@/src/infrastructure/persistence/season-planning-schema';
import { eq, and } from 'drizzle-orm';
import type { TrainerAvailabilitySummary } from '@/lib/season-planning/types';

interface RouteContext { params: Promise<{ id: string }>; }

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, { max: 30, windowMs: 60000 });
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;
      const [season] = await getDb().select().from(seasons).where(eq(seasons.id, seasonId));
      if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

      const isAdmin = await verifyRole(auth, 'admin');
      const isSuperadmin = await verifyRole(auth, 'superadmin');
      if (!isAdmin && !isSuperadmin) return forbiddenResponse('Nur Admins');

      const db = getDb();

      // Get trainer preferences
      const trainerPrefs = await db
        .select({
          pref: userTrainingPreferences,
          trainer: trainersTable,
          user_name: users.full_name,
        })
        .from(userTrainingPreferences)
        .innerJoin(users, eq(userTrainingPreferences.user_id, users.id))
        .innerJoin(trainersTable, eq(users.email, trainersTable.email))
        .where(
          and(
            eq(userTrainingPreferences.season_id, seasonId),
            eq(userTrainingPreferences.is_submitted, true),
            eq(userTrainingPreferences.user_role, 'trainer')
          )
        );

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

      const trainerSummaries = trainerPrefs.map((tp) => {
        const maxHours = tp.trainer?.max_hours_per_week || 30;
        const effectiveMaxHours = maxHours * (maxUtilizationPct / 100);
        const sessionsAssigned = existingEntries.filter((e) => e.trainer_id === tp.pref.user_id).length;
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

        return {
          trainerId: tp.pref.user_id,
          trainerName: tp.user_name || tp.trainer?.name || 'Unbekannt',
          maxHoursPerWeek: maxHours,
          maxUtilizationPct,
          effectiveMaxHours,
          currentAssignedHours: hoursAssigned,
          availableSlots,
          utilizationStatus,
        };
      });

      const overallUtilization =
        trainerSummaries.length > 0
          ? trainerSummaries.reduce((sum, t) => {
              const pct = t.effectiveMaxHours > 0 ? (t.currentAssignedHours / t.effectiveMaxHours) * 100 : 0;
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
      console.error('GET trainers error:', error);
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  });
}

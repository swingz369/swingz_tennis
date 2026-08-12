// PUT /api/seasons/[id]/config
// Updates the per-season planning config (season_planning_configs) for the given season.
// Admin-only, club-scoped. Used by the settings UI to persist the new
// treat_high_failure_as_hard and backtrack_depth options.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { authorizeSeasonAccess } from '@/lib/season-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { db } from '@/src/infrastructure/persistence/db';
import { seasonPlanningConfigs } from '@/src/infrastructure/persistence/season-planning-schema';
import { and, eq } from 'drizzle-orm';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:config');

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Whitelist of fields that can be updated via this endpoint. Anything else is
// ignored to prevent accidental overwrites of internal/derived columns.
const UPDATABLE_FIELDS = [
  'max_niveau_span_beginner_months',
  'max_niveau_span_advanced_months',
  'trainer_utilization_max_pct',
  'group_max_size',
  'group_min_size',
  'proven_group_attendance_threshold_pct',
  'slot_failure_rate_threshold_pct',
  'waitlist_priority_rule',
  'prefer_historic_groups',
  'avoid_high_failure_slots',
  'treat_high_failure_as_hard',
  'backtrack_depth',
  'kids_group_max_size',
  'kids_group_min_size',
  'slot_duration_minutes',
] as const;

export async function PUT(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, { max: 30, windowMs: 60000 });
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;

      // Zentrale Prüfung statt inline dupliziertem Rollen- und Clubcheck,
      // siehe lib/season-auth.ts. Verhalten identisch: Superadmin und Owner
      // über den Fast-Path, sonst Mitgliedschaft im Club der Saison mit
      // Rolle admin oder superadmin.
      const access = await authorizeSeasonAccess(auth, seasonId, {
        allowedRoles: ['admin', 'superadmin'],
      });
      if (!access.ok) return access.response;
      const { season } = access;

      const body = (await request.json()) as Record<string, any>;
      if (!body || typeof body !== 'object') {
        return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
      }

      // Build the update payload from the whitelist
      const updatePayload: Record<string, any> = {};
      for (const field of UPDATABLE_FIELDS) {
        if (field in body) updatePayload[field] = body[field];
      }

      // Clamp backtrack_depth to 0..10 (CHECK constraint in DB is 0..10)
      if ('backtrack_depth' in updatePayload) {
        const depth = Number(updatePayload.backtrack_depth);
        if (!Number.isFinite(depth) || depth < 0 || depth > 10) {
          return NextResponse.json(
            { error: 'backtrack_depth must be a number between 0 and 10' },
            { status: 400 }
          );
        }
        updatePayload.backtrack_depth = depth;
      }

      // Coerce boolean fields to real booleans (defensive against string "true"/"false")
      for (const boolField of [
        'prefer_historic_groups',
        'avoid_high_failure_slots',
        'treat_high_failure_as_hard',
      ] as const) {
        if (boolField in updatePayload && typeof updatePayload[boolField] !== 'boolean') {
          updatePayload[boolField] =
            updatePayload[boolField] === 'true' || updatePayload[boolField] === 1;
        }
      }

      if (Object.keys(updatePayload).length === 0) {
        return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
      }

      // Upsert: insert if missing, otherwise update
      const [existing] = await db
        .select()
        .from(seasonPlanningConfigs)
        .where(
          and(
            eq(seasonPlanningConfigs.club_id, season.club_id),
            eq(seasonPlanningConfigs.season_id, seasonId)
          )
        );

      let result;
      if (existing) {
        await db
          .update(seasonPlanningConfigs)
          .set(updatePayload)
          .where(eq(seasonPlanningConfigs.id, existing.id));
        [result] = await db
          .select()
          .from(seasonPlanningConfigs)
          .where(eq(seasonPlanningConfigs.id, existing.id));
      } else {
        const insertPayload = {
          club_id: season.club_id,
          season_id: seasonId,
          ...updatePayload,
        };
        [result] = await db.insert(seasonPlanningConfigs).values(insertPayload).returning();
      }

      return NextResponse.json({
        success: true,
        config: result,
      });
    } catch (error) {
      log.error('PUT season config error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal error' },
        { status: 500 }
      );
    }
  });
}

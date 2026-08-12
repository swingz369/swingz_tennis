// GET+PUT /api/seasons/[id]/planning/config
// Manages the per-season planning config (treat_high_failure_as_hard, backtrack_depth, etc.)

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { authorizeSeasonAccess } from '@/lib/season-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { db } from '@/src/infrastructure/persistence/db';
import { seasonPlanningConfigs } from '@/src/infrastructure/persistence/season-planning-schema';
import { and, eq } from 'drizzle-orm';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:planning:config');

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Whitelist of fields that can be updated via this endpoint. Anything else is
// ignored to avoid accidental overwrites of internal/derived columns.
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
  'unassigned_rate_threshold',
] as const;

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, { max: 60, windowMs: 60000 });
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

      const [config] = await db
        .select()
        .from(seasonPlanningConfigs)
        .where(
          and(
            eq(seasonPlanningConfigs.club_id, season.club_id),
            eq(seasonPlanningConfigs.season_id, seasonId)
          )
        );

      return NextResponse.json({
        success: true,
        config: config ?? null,
        // Frontend-friendly defaults so the UI can render before the row exists
        defaults: {
          treat_high_failure_as_hard: false,
          backtrack_depth: 0,
        },
      });
    } catch (error) {
      log.error('GET planning config error:', error);
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  });
}

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

      // Clamp unassigned_rate_threshold to 0..1 (CHECK constraint in DB is 0..1)
      // Sprint 4 P0 #3 (Adaptive Backtrack): if the unassigned-member rate after
      // the first pass is still above this threshold, the engine runs a second
      // pass with depth=5. Set to 1.0 to effectively disable the second pass.
      if ('unassigned_rate_threshold' in updatePayload) {
        const threshold = Number(updatePayload.unassigned_rate_threshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
          return NextResponse.json(
            { error: 'unassigned_rate_threshold must be a number between 0 and 1' },
            { status: 400 }
          );
        }
        updatePayload.unassigned_rate_threshold = threshold;
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
      log.error('PUT planning config error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal error' },
        { status: 500 }
      );
    }
  });
}

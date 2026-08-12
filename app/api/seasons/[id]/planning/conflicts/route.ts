// GET+POST+PATCH /api/seasons/[id]/planning/conflicts
// Schritt 5: Get detected conflicts, run detection, and resolve/ignore

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { authorizeSeasonAccess } from '@/lib/season-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { db } from '@/src/infrastructure/persistence/db';
import { planningConflicts } from '@/src/infrastructure/persistence/schema';
import { eq } from 'drizzle-orm';
import { detectConflictsForSeason } from '@/lib/season-planning/conflict-detector';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:planning:conflicts');

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
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

      const { conflicts, summary } = await detectConflictsForSeason(seasonId, season.club_id);

      return NextResponse.json({
        success: true,
        conflicts,
        summary,
      });
    } catch (error) {
      log.error('GET conflicts error:', error);
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  });
}

// POST: Same as GET — runs conflict detection (used by wizard step 5)
export async function POST(request: NextRequest, context: RouteContext) {
  return GET(request, context);
}

// PATCH: Resolve or ignore a specific conflict
export async function PATCH(request: NextRequest, context: RouteContext) {
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

      const body = (await request.json()) as {
        conflictId: string;
        action: 'resolve' | 'ignore';
        notes?: string;
      };
      if (!body.conflictId || !body.action) {
        return NextResponse.json({ error: 'conflictId and action required' }, { status: 400 });
      }

      const newStatus = body.action === 'resolve' ? 'resolved' : 'ignored';

      // Update in planning_conflicts table if it exists
      const [existing] = await db
        .select()
        .from(planningConflicts)
        .where(eq(planningConflicts.id, body.conflictId));

      if (existing) {
        await db
          .update(planningConflicts)
          .set({
            status: newStatus,
            resolution_action: body.action,
            resolution_notes: body.notes || null,
            resolved_at: new Date(),
            resolved_by: auth.user.id,
          })
          .where(eq(planningConflicts.id, body.conflictId));
      }

      return NextResponse.json({
        success: true,
        conflictId: body.conflictId,
        status: newStatus,
      });
    } catch (error) {
      log.error('PATCH conflicts error:', error);
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  });
}

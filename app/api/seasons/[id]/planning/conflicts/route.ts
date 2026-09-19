// GET+POST+PATCH /api/seasons/[id]/planning/conflicts
// Schritt 5: Get detected conflicts, run detection, and resolve/ignore

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { authorizeSeasonAccess } from '@/lib/season-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { conflictRepositoryFor } from '@/infrastructure/persistence/repositories/conflict-detection.repository';
import { detectConflictsForSeason, conflictRowId } from '@/lib/season-planning/conflict-detector';
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

      const { conflicts, summary } = await detectConflictsForSeason(
        seasonId,
        season.club_id,
        conflictRepositoryFor(auth)
      );

      return NextResponse.json({
        success: true,
        conflicts,
        summary,
      });
    } catch (error) {
      log.error('GET conflicts error:', error);
      return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
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
        return NextResponse.json({ error: 'conflictId und action erforderlich' }, { status: 400 });
      }

      const newStatus = body.action === 'resolve' ? 'resolved' : 'ignored';

      // Konflikte werden live erkannt und tragen synthetische IDs — sie stehen
      // nicht als Zeile in planning_conflicts. Wir suchen den Konflikt in der
      // aktuellen Erkennung und schreiben die Entscheidung unter einer aus der
      // ID abgeleiteten, stabilen UUID fest (siehe conflictRowId).
      const repo = conflictRepositoryFor(auth);
      const { conflicts } = await detectConflictsForSeason(seasonId, access.season.club_id, repo);
      const conflict = conflicts.find((c) => c.id === body.conflictId);
      if (!conflict) {
        return NextResponse.json({ error: 'Konflikt nicht gefunden' }, { status: 404 });
      }

      const rowId = conflictRowId(seasonId, conflict.id);
      await repo.saveDecision({
        id: rowId,
        season_id: seasonId,
        club_id: access.season.club_id,
        conflict_type: conflict.type,
        severity: conflict.severity,
        affected_plan_entry_ids: conflict.affectedEntities?.planEntryIds || [],
        affected_user_ids: conflict.affectedEntities?.memberIds || [],
        affected_group_ids: conflict.affectedEntities?.groupIds || [],
        description: conflict.description,
        suggested_resolution: conflict.suggestedResolution,
        // Check-Constraint erlaubt nur auto_planner|manual_check|user_report|system
        detection_source: 'manual_check',
        status: newStatus,
        resolution_action: body.action,
        resolution_notes: body.notes || null,
        resolved_at: new Date().toISOString(),
        resolved_by: auth.user.id,
      });

      return NextResponse.json({
        success: true,
        conflictId: body.conflictId,
        status: newStatus,
      });
    } catch (error) {
      log.error('PATCH conflicts error:', error);
      return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
    }
  });
}

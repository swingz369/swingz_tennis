// POST /api/seasons/[id]/planning/cluster
// Schritt 4: Run automatisches Clustering (regelbasierter Constraint-Solver, kein LLM)

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { authorizeSeasonAccess } from '@/lib/season-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { SeasonClusteringEngine } from '@/lib/season-planning/clustering-engine';
import type { RunClusteringRequest } from '@/lib/season-planning/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:planning:cluster');

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, { max: 50, windowMs: 3600000 });
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

      const body: RunClusteringRequest = await request.json();
      const dryRun = body.dryRun !== false;

      const engine = new SeasonClusteringEngine(seasonId, season.club_id, body.config);
      const result = await engine.runClustering(dryRun);

      return NextResponse.json({
        success: true,
        seasonId,
        dryRun,
        result: {
          groups: result.groups.map((g) => ({
            groupId: g.groupId,
            groupName: g.groupName,
            trainerId: g.trainerId,
            trainerName: g.trainerName,
            dayOfWeek: g.dayOfWeek,
            startTime: g.startTime,
            endTime: g.endTime,
            courtId: g.courtId,
            courtName: g.courtName,
            memberCount: g.memberIds.length,
            memberDetails: g.memberDetails,
            waitlistCount: g.waitlistIds.length,
            warnings: g.warnings,
          })),
          unassignedMembers: result.unassignedMembers,
          waitlistSummary: result.waitlistSummary,
          metrics: result.metrics,
          explanations: result.explanations,
        },
      });
    } catch (error) {
      log.error('POST cluster error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Clustering failed' },
        { status: 500 }
      );
    }
  });
}

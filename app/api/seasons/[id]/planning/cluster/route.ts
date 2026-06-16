// POST /api/seasons/[id]/planning/cluster
// Schritt 4: Run KI-Clustering algorithm

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { db } from '@/src/infrastructure/persistence/db';
import { seasons } from '@/src/infrastructure/persistence/schema';
import { eq } from 'drizzle-orm';
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
      const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
      if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

      const isAdmin = await verifyRole(auth, 'admin');
      const isSuperadmin = await verifyRole(auth, 'superadmin');
      if (!isAdmin && !isSuperadmin) return forbiddenResponse('Nur Admins');
      // Check club access via memberships (not just active club) — admin may belong to multiple clubs
      if (!isSuperadmin) {
        const hasClubAccess = auth.memberships.some(
          (m) => m.club_id === season.club_id && (m.role === 'admin' || m.role === 'superadmin')
        );
        if (!hasClubAccess) return forbiddenResponse('Kein Zugriff auf diesen Club');
      }

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

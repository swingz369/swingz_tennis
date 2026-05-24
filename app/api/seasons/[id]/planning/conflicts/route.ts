// GET+POST+PATCH /api/seasons/[id]/planning/conflicts
// Schritt 5: Get detected conflicts, run detection, and resolve/ignore

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { getDb } from '@/src/infrastructure/persistence/client';
import {
  seasons,
  seasonPlanEntries,
  planningConflicts,
} from '@/src/infrastructure/persistence/schema';
import { eq } from 'drizzle-orm';
import { ConflictDetector } from '@/lib/season-planning/conflict-detector';
import type { GroupAssignment } from '@/lib/season-planning/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function detectConflictsForSeason(seasonId: string, clubId: string) {
  const detector = new ConflictDetector(seasonId, clubId);
  const entries = await getDb()
    .select()
    .from(seasonPlanEntries)
    .where(eq(seasonPlanEntries.season_id, seasonId));

  // Build assignments from plan entries
  const assignments: GroupAssignment[] = [];
  const groupMap = new Map<string, GroupAssignment>();
  for (const entry of entries) {
    const gid = entry.group_id || entry.id;
    if (groupMap.has(gid)) {
      groupMap.get(gid)!.memberIds.push(...((entry.expected_participants as string[]) || []));
    } else {
      groupMap.set(gid, {
        groupId: gid,
        groupName: gid,
        trainerId: entry.trainer_id,
        trainerName: entry.trainer_id,
        dayOfWeek: entry.day_of_week as any,
        startTime: entry.start_time?.substring(0, 5) || '00:00',
        endTime: entry.end_time?.substring(0, 5) || '00:00',
        courtId: entry.court_id,
        courtName: entry.court_id,
        memberIds: (entry.expected_participants as string[]) || [],
        memberDetails: [],
        waitlistIds: [],
        waitlistDetails: [],
        warnings: [],
        conflictIds: [],
      });
    }
  }
  assignments.push(...groupMap.values());

  const conflicts = await detector.detectAll(assignments);
  const summary = detector.summarize(conflicts);
  return { conflicts, summary };
}

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
      if (!isSuperadmin && season.club_id !== auth.clubId) return forbiddenResponse('Kein Zugriff');

      const { conflicts, summary } = await detectConflictsForSeason(seasonId, season.club_id);

      return NextResponse.json({
        success: true,
        conflicts,
        summary,
      });
    } catch (error) {
      console.error('GET conflicts error:', error);
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
      const [season] = await getDb().select().from(seasons).where(eq(seasons.id, seasonId));
      if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

      const isAdmin = await verifyRole(auth, 'admin');
      const isSuperadmin = await verifyRole(auth, 'superadmin');
      if (!isAdmin && !isSuperadmin) return forbiddenResponse('Nur Admins');
      if (!isSuperadmin && season.club_id !== auth.clubId) return forbiddenResponse('Kein Zugriff');

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
      const [existing] = await getDb()
        .select()
        .from(planningConflicts)
        .where(eq(planningConflicts.id, body.conflictId));

      if (existing) {
        await getDb()
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
      console.error('PATCH conflicts error:', error);
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  });
}

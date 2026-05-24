// GET /api/seasons/[id]/planning/waitlist
// Schritt 4d + 7: Get waitlist state and manage waitlist operations

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { getDb } from '@/src/infrastructure/persistence/client';
import { seasons, users } from '@/src/infrastructure/persistence/schema';
import { seasonWaitlists } from '@/src/infrastructure/persistence/season-planning-schema';
import { eq, asc } from 'drizzle-orm';

interface RouteContext {
  params: Promise<{ id: string }>;
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

      const waitlist = await getDb()
        .select({
          entry: seasonWaitlists,
          member_name: users.full_name,
        })
        .from(seasonWaitlists)
        .leftJoin(users, eq(seasonWaitlists.member_id, users.id))
        .where(eq(seasonWaitlists.season_id, seasonId))
        .orderBy(asc(seasonWaitlists.group_id), asc(seasonWaitlists.position));

      return NextResponse.json({
        success: true,
        waitlist: waitlist.map((w) => ({
          ...w.entry,
          member_name: w.member_name,
        })),
        totalCount: waitlist.length,
        waitingCount: waitlist.filter((w) => w.entry.status === 'waiting').length,
      });
    } catch (error) {
      console.error('GET waitlist error:', error);
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  });
}

/**
 * POST /api/seasons/[id]/planning/waitlist/promote
 * Manually promote a waitlisted member (when a slot opens)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  return withCSRFProtection(request, async () => {
    return withApiAuth(request, async (auth) => {
      try {
        const { id: _seasonId } = await context.params;
        const isAdmin = await verifyRole(auth, 'admin');
        if (!isAdmin) return forbiddenResponse('Nur Admins');

        const body = await request.json();
        const { waitlistId, promoteToGroupId } = body;

        if (!waitlistId) {
          return NextResponse.json({ error: 'waitlistId required' }, { status: 400 });
        }

        const [entry] = await getDb()
          .select()
          .from(seasonWaitlists)
          .where(eq(seasonWaitlists.id, waitlistId));

        if (!entry)
          return NextResponse.json({ error: 'Waitlist entry not found' }, { status: 404 });

        // Update waitlist entry
        await getDb()
          .update(seasonWaitlists)
          .set({
            status: 'accepted',
            accepted_at: new Date(),
            alternative_group_id: promoteToGroupId || null,
            alternative_assigned_at: new Date(),
          })
          .where(eq(seasonWaitlists.id, waitlistId));

        return NextResponse.json({
          success: true,
          message: `Mitglied von Warteliste in Gruppe verschoben`,
        });
      } catch (error) {
        console.error('POST waitlist promote error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
      }
    });
  });
}

// GET /api/seasons/[id]/planning/waitlist
// Schritt 4d + 7: Get waitlist state and manage waitlist operations

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, forbiddenResponse } from '@/lib/api-auth';
import { authorizeSeasonAccess } from '@/lib/season-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { db } from '@/src/infrastructure/persistence/db';
import { users, seasonPlanEntries } from '@/src/infrastructure/persistence/schema';
import { seasonWaitlists } from '@/src/infrastructure/persistence/season-planning-schema';
import { eq, asc, and } from 'drizzle-orm';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:planning:waitlist');

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

      const waitlist = await db
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
      log.error('GET waitlist error:', error);
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
        const { id: seasonId } = await context.params;
        // Vorher wurde hier nur `if (!isAdmin)` geprüft — der Clubbezug kam
        // erst weiter unten und hing am Waitlist-Eintrag statt an der Saison.
        // Die Saison selbst war damit nie autorisiert. `isSuperadmin` wurde
        // an dieser Stelle berechnet und nie ausgewertet.
        const access = await authorizeSeasonAccess(auth, seasonId, {
          allowedRoles: ['admin', 'superadmin'],
        });
        if (!access.ok) return access.response;

        const body = await request.json();
        const { waitlistId, promoteToGroupId } = body;

        if (!waitlistId) {
          return NextResponse.json({ error: 'waitlistId required' }, { status: 400 });
        }

        const [entry] = await db
          .select()
          .from(seasonWaitlists)
          .where(eq(seasonWaitlists.id, waitlistId));

        if (!entry)
          return NextResponse.json({ error: 'Waitlist entry not found' }, { status: 404 });

        if (entry.season_id !== seasonId) {
          return NextResponse.json({ error: 'Waitlist entry not found' }, { status: 404 });
        }

        // Der Zugriff auf die Saison ist oben bereits geprüft, und Zeile 97
        // stellt sicher, dass der Eintrag zu dieser Saison gehört. Bleibt der
        // direkte Abgleich, falls Eintrag und Saison auseinanderlaufen —
        // strenger als die vorherige Rollenprüfung und ohne Rollenlogik.
        if (entry.club_id !== access.season.club_id) {
          return forbiddenResponse('Kein Zugriff auf diesen Club');
        }

        // Add the member to the target group's plan entries (capacity permitting)
        const targetGroupId = promoteToGroupId || entry.group_id;
        const targetEntries = await db
          .select()
          .from(seasonPlanEntries)
          .where(
            and(
              eq(seasonPlanEntries.season_id, seasonId),
              eq(seasonPlanEntries.group_id, targetGroupId)
            )
          );

        if (targetEntries.length === 0) {
          return NextResponse.json(
            { error: 'Keine Trainingstermine für die Zielgruppe gefunden' },
            { status: 400 }
          );
        }

        const full = targetEntries.filter((e) => {
          const participants = (e.expected_participants as string[]) || [];
          return (
            !participants.includes(entry.member_id) && participants.length >= e.max_participants
          );
        });
        if (full.length > 0) {
          return NextResponse.json(
            { error: 'Zielgruppe hat keinen freien Platz mehr' },
            { status: 409 }
          );
        }

        for (const planEntry of targetEntries) {
          const participants = (planEntry.expected_participants as string[]) || [];
          if (participants.includes(entry.member_id)) continue;
          await db
            .update(seasonPlanEntries)
            .set({ expected_participants: [...participants, entry.member_id] })
            .where(eq(seasonPlanEntries.id, planEntry.id));
        }

        // Update waitlist entry
        await db
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
        log.error('POST waitlist promote error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
      }
    });
  });
}

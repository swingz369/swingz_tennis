import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { db } from '@/src/infrastructure/persistence/db';
import { seasons, seasonGroupWeeks } from '@/src/infrastructure/persistence/schema';
import { eq, and } from 'drizzle-orm';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:planning:inactive-weeks');

interface RouteContext {
  params: Promise<{ id: string }>;
}

function weekMonday(seasonStart: Date, weekNumber: number): string {
  const d = new Date(seasonStart);
  d.setUTCDate(d.getUTCDate() + (weekNumber - 1) * 7);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, { max: 30, windowMs: 60000 });
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;
      const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
      if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

      const isAdmin = await verifyRole(auth, 'admin');
      const isSuperadmin = await verifyRole(auth, 'superadmin');
      if (!isAdmin && !isSuperadmin) return forbiddenResponse('Nur Admins');

      // verifyRole() prüft nur die GLOBALE Rolle des Aufrufers, nicht die
      // Zugehörigkeit zum Verein dieser Saison. Ohne den Check hier konnte
      // ein Admin eines beliebigen anderen Vereins die Wochenplanung einer
      // fremden Saison lesen. POST hatte den Check bereits, GET nicht.
      if (!isSuperadmin) {
        const hasClubAccess = auth.memberships.some(
          (m) => m.club_id === season.club_id && (m.role === 'admin' || m.role === 'superadmin')
        );
        if (!hasClubAccess) return forbiddenResponse('Kein Zugriff auf diesen Club');
      }

      const rows = await db
        .select({
          group_id: seasonGroupWeeks.group_id,
          week_number: seasonGroupWeeks.week_number,
          is_active: seasonGroupWeeks.is_active,
        })
        .from(seasonGroupWeeks)
        .where(eq(seasonGroupWeeks.season_id, seasonId));

      return NextResponse.json({ weeks: rows });
    } catch (error) {
      log.error('GET inactive-weeks error', error instanceof Error ? error : undefined);
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, { max: 10, windowMs: 60000 });
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;
      const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
      if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

      const isAdmin = await verifyRole(auth, 'admin');
      const isSuperadmin = await verifyRole(auth, 'superadmin');
      if (!isAdmin && !isSuperadmin) return forbiddenResponse('Nur Admins');
      if (!isSuperadmin) {
        const hasClubAccess = auth.memberships.some(
          (m) => m.club_id === season.club_id && (m.role === 'admin' || m.role === 'superadmin')
        );
        if (!hasClubAccess) return forbiddenResponse('Kein Zugriff auf diesen Club');
      }

      const body = await request.json();
      const weeks: Array<{ groupId: string; weekNumber: number; isActive: boolean }> =
        body.weeks ?? [];
      if (!Array.isArray(weeks)) {
        return NextResponse.json({ error: 'weeks must be an array' }, { status: 400 });
      }

      await db.transaction(async (tx) => {
        for (const week of weeks) {
          const [existing] = await tx
            .select({ id: seasonGroupWeeks.id })
            .from(seasonGroupWeeks)
            .where(
              and(
                eq(seasonGroupWeeks.season_id, seasonId),
                eq(seasonGroupWeeks.group_id, week.groupId),
                eq(seasonGroupWeeks.week_number, week.weekNumber)
              )
            )
            .limit(1);

          if (existing) {
            await tx
              .update(seasonGroupWeeks)
              .set({ is_active: week.isActive, updated_at: new Date() })
              .where(eq(seasonGroupWeeks.id, existing.id));
          } else if (!week.isActive) {
            // Only create rows for inactive weeks — active is the implicit default
            await tx.insert(seasonGroupWeeks).values({
              season_id: seasonId,
              group_id: week.groupId,
              club_id: season.club_id,
              week_number: week.weekNumber,
              week_monday: weekMonday(season.start_date, week.weekNumber),
              is_active: false,
            });
          }
        }
      });

      log.info('Inactive weeks updated', { seasonId, count: weeks.length });
      return NextResponse.json({ success: true, updated: weeks.length });
    } catch (error) {
      log.error('POST inactive-weeks error', error instanceof Error ? error : undefined);
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  });
}

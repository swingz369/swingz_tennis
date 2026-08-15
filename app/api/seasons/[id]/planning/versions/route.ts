// Gespeicherte Planstände einer Saison.
//
//   GET  → Liste (ohne slots, nur Kopfdaten)
//   POST → aktuellen Stand sichern  { label?, slots }
//   PUT  → Stand wiederherstellen   { versionId }
//
// Warum das existiert: SeasonClusteringEngine.saveToDatabase löscht bei jedem Lauf
// alle season_plan_entries der Saison. Wer nach einer Neugenerierung feststellt,
// dass die vorige Fassung besser war, hatte bisher keinen Weg zurück.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { authorizeSeasonAccess } from '@/lib/season-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { db } from '@/src/infrastructure/persistence/db';
import { users } from '@/src/infrastructure/persistence/schema';
import { seasonPlanVersions } from '@/src/infrastructure/persistence/season-planning-schema';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { applySlotsToPlanEntries } from '@/lib/season-planning/apply-plan';
import type { ScheduleSlot } from '@/lib/season-planning/types';
import { formatDateTime } from '@/lib/format';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:planning:versions');

/** Ältere Stände fallen raus — ein Verein vergleicht ein paar Fassungen, kein Archiv. */
const MAX_VERSIONS = 10;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, { max: 60, windowMs: 60000 });
  if (rateLimitError) return rateLimitError;

  return withApiAuth(request, async (auth) => {
    try {
      const { id: seasonId } = await context.params;
      const access = await authorizeSeasonAccess(auth, seasonId, {
        allowedRoles: ['admin', 'superadmin'],
      });
      if (!access.ok) return access.response;

      const rows = await db
        .select({
          id: seasonPlanVersions.id,
          label: seasonPlanVersions.label,
          created_at: seasonPlanVersions.created_at,
          slots: seasonPlanVersions.slots,
          created_by_name: users.full_name,
        })
        .from(seasonPlanVersions)
        .leftJoin(users, eq(seasonPlanVersions.created_by, users.id))
        .where(eq(seasonPlanVersions.season_id, seasonId))
        .orderBy(desc(seasonPlanVersions.created_at));

      return NextResponse.json({
        success: true,
        versions: rows.map((r) => ({
          id: r.id,
          label: r.label,
          createdAt: r.created_at,
          createdByName: r.created_by_name,
          groupCount: Array.isArray(r.slots) ? r.slots.length : 0,
        })),
      });
    } catch (error) {
      log.error('GET versions error:', error instanceof Error ? error : undefined);
      return NextResponse.json({ error: 'Planstände nicht abrufbar' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  return withCSRFProtection(request, async () => {
    return withApiAuth(request, async (auth) => {
      try {
        const { id: seasonId } = await context.params;
        const access = await authorizeSeasonAccess(auth, seasonId, {
          allowedRoles: ['admin', 'superadmin'],
        });
        if (!access.ok) return access.response;

        const body = await request.json();
        const slots = body?.slots as ScheduleSlot[] | undefined;
        if (!Array.isArray(slots) || slots.length === 0) {
          return NextResponse.json({ error: 'Kein Plan zum Speichern' }, { status: 400 });
        }

        const label = (body?.label as string | undefined)?.trim().slice(0, 100);

        const [created] = await db
          .insert(seasonPlanVersions)
          .values({
            season_id: seasonId,
            club_id: access.season.club_id,
            created_by: auth.user.id,
            label: label || `Stand ${formatDateTime(new Date())}`,
            slots,
          })
          .returning({ id: seasonPlanVersions.id, label: seasonPlanVersions.label });

        // Überzählige Stände abräumen — ohne das wächst die Liste unbegrenzt.
        const all = await db
          .select({ id: seasonPlanVersions.id })
          .from(seasonPlanVersions)
          .where(eq(seasonPlanVersions.season_id, seasonId))
          .orderBy(desc(seasonPlanVersions.created_at));
        const obsolete = all.slice(MAX_VERSIONS).map((v) => v.id);
        if (obsolete.length > 0) {
          await db.delete(seasonPlanVersions).where(inArray(seasonPlanVersions.id, obsolete));
        }

        return NextResponse.json({ success: true, version: created });
      } catch (error) {
        log.error('POST version error:', error instanceof Error ? error : undefined);
        return NextResponse.json({ error: 'Stand konnte nicht gesichert werden' }, { status: 500 });
      }
    });
  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return withCSRFProtection(request, async () => {
    return withApiAuth(request, async (auth) => {
      try {
        const { id: seasonId } = await context.params;
        const access = await authorizeSeasonAccess(auth, seasonId, {
          allowedRoles: ['admin', 'superadmin'],
        });
        if (!access.ok) return access.response;

        const { versionId } = await request.json();
        if (!versionId) {
          return NextResponse.json({ error: 'versionId erforderlich' }, { status: 400 });
        }

        const [version] = await db
          .select()
          .from(seasonPlanVersions)
          .where(
            and(
              eq(seasonPlanVersions.id, versionId),
              eq(seasonPlanVersions.season_id, seasonId) // kein Zugriff über Saisongrenzen
            )
          );
        if (!version) {
          return NextResponse.json({ error: 'Planstand nicht gefunden' }, { status: 404 });
        }

        const slots = (version.slots ?? []) as ScheduleSlot[];
        const result = await applySlotsToPlanEntries(seasonId, slots);

        return NextResponse.json({ success: true, slots, ...result });
      } catch (error) {
        log.error('PUT restore version error:', error instanceof Error ? error : undefined);
        return NextResponse.json(
          { error: 'Planstand konnte nicht wiederhergestellt werden' },
          { status: 500 }
        );
      }
    });
  });
}

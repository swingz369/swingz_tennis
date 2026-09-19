// PUT /api/seasons/[id]/planning/plan
// Übernimmt den im Wizard bearbeiteten Wochenstundenplan in season_plan_entries,
// damit das Bestätigen (planning/confirm liest aus der DB) den Stand sieht, den der
// Admin auf dem Bildschirm hat.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { authorizeSeasonAccess } from '@/lib/season-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { SeasonPlanService } from '@/application/services/season-plan.service';
import type { ScheduleSlot } from '@/lib/season-planning/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:[id]:planning:plan');

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const rateLimitError = await checkRateLimitOrFail(request, { max: 60, windowMs: 60000 });
  if (rateLimitError) return rateLimitError;

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
        if (!Array.isArray(slots)) {
          return NextResponse.json({ error: 'slots erforderlich' }, { status: 400 });
        }
        // Ein leeres Raster würde jeden Termin unangetastet lassen, sieht aber wie ein
        // versehentlicher Aufruf aus (State noch nicht geladen) — lieber ablehnen.
        if (slots.length === 0) {
          return NextResponse.json({ error: 'Leerer Plan wird nicht übernommen' }, { status: 400 });
        }

        const result = await new SeasonPlanService(auth).applySlots(seasonId, slots);
        return NextResponse.json({ success: true, ...result });
      } catch (error) {
        log.error('PUT plan error:', error instanceof Error ? error : undefined);
        return NextResponse.json(
          { error: 'Plan konnte nicht gespeichert werden' },
          { status: 500 }
        );
      }
    });
  });
}

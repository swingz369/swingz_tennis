// POST /api/plan-entries/[entryId]/reschedule
//
// Verschiebt eine bereits veröffentlichte Trainingsgruppe auf einen neuen
// Wochentag/Zeit/Trainer/Platz — ab einem wählbaren Datum (Standard: jetzt).
// Ändert sowohl alle künftigen `sessions`-Zeilen (das, was Trainer/Mitglieder
// im Wochenplan sehen) als auch die Saisonplan-Vorlage selbst.
// Fachlogik: SeasonPlanService.reschedule (ADR-005), Schreiben atomar per
// DB-Funktion reschedule_plan_entry.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ApiException,
  errorResponse,
  internalErrorResponse,
  safeErrorMessage,
} from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { SeasonPlanService } from '@/application/services/season-plan.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:plan-entries:[entryId]:reschedule');

interface RouteContext {
  params: Promise<{ entryId: string }>;
}

const bodySchema = z.object({
  day_of_week: z.number().int().min(0).max(6).optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  trainer_id: z.string().uuid().optional(),
  court_id: z.string().uuid().nullable().optional(),
  effective_from: z.string().optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  return withCSRFProtection(request, async () => {
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      const { entryId } = await context.params;
      try {
        if (!(await verifyRole(auth, 'admin'))) {
          return forbiddenResponse('Nur Admins können Trainingszeiten verschieben');
        }

        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return errorResponse('VALIDATION_ERROR', 'Ungültige Eingabe', {
            details: parsed.error.issues,
          });
        }

        const moved = await new SeasonPlanService(auth).reschedule(entryId, parsed.data);
        return NextResponse.json({
          success: true,
          movedSessions: moved,
          message: `${moved} Trainingseinheit${moved !== 1 ? 'en' : ''} verschoben`,
        });
      } catch (error) {
        if (error instanceof ApiException) {
          return errorResponse(error.code, safeErrorMessage(error), {
            status: error.status,
            details: error.details,
          });
        }
        log.error(`POST /api/plan-entries/${entryId}/reschedule error:`, error);
        return internalErrorResponse();
      }
    });
  });
}

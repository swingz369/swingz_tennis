/**
 * Stripe Connect des aktiven Vereins (ADR-008).
 * GET  — Status (verbunden, Zahlungen freigeschaltet, Angaben vollständig)
 * POST — Stripe-Konto anlegen (falls nötig) und Einrichtungs-Link zurückgeben
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  errorResponse,
  internalErrorResponse,
  ApiException,
  safeErrorMessage,
} from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { appBaseUrl } from '@/lib/app-url';
import { StripeConnectService } from '@/application/services/stripe-connect.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:stripe:connect');

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse('Zugriff nur für Admins');
    if (!auth.clubId) return forbiddenResponse('Kein aktiver Verein ausgewählt');

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    try {
      const status = await new StripeConnectService(auth).getStatus(auth.clubId);
      return NextResponse.json(status);
    } catch (error) {
      log.error('Stripe-Connect-Status fehlgeschlagen', error instanceof Error ? error : undefined);
      return internalErrorResponse();
    }
  });
}

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse('Zugriff nur für Admins');
    if (!auth.clubId) return forbiddenResponse('Kein aktiver Verein ausgewählt');

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
    if (rateLimitError) return rateLimitError;

    try {
      const returnUrl = `${appBaseUrl(request.nextUrl.origin)}/admin/billing?tab=online`;
      const url = await new StripeConnectService(auth).createOnboardingLink(auth.clubId, returnUrl);
      return NextResponse.json({ url });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error(
        'Stripe-Connect-Einrichtung fehlgeschlagen',
        error instanceof Error ? error : undefined
      );
      return internalErrorResponse();
    }
  });
}

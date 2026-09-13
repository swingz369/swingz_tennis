import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  internalErrorResponse,
  ApiException,
  errorResponse,
  safeErrorMessage,
} from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { BillingService } from '@/src/application/services/billing.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:billing:trainers:[id]');

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    // Wie die Schwester-Routen (pay, overdue): Admin verwaltet die
    // Trainer-Abrechnung seines Vereins. Vorher auch 'trainer' zugelassen —
    // ohne Aufrufer im Frontend und ohne Eigentümer-Check hätte das jedem
    // Trainer erlaubt, die Honorardaten jedes anderen Trainers per ID
    // auszulesen.
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    try {
      await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);

      const { id } = await params;
      const trainerBilling = await new BillingService(auth).getTrainerBillingById(id);
      return NextResponse.json({ trainerBilling });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Trainer billing fetch error:', error);
      return internalErrorResponse();
    }
  });
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    // Dieselbe Korrektur wie beim GET oben: Admin-only statt 'admin' ODER
    // 'trainer' — sonst hätte jeder Trainer Status, Rechnungsnummer und
    // Notizen jeder fremden Abrechnung ändern können.
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    try {
      await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);

      const { id } = await params;
      const body = await _request.json();

      const { status, invoiceId, invoiceNumber, dueDate, paidAt, notes } = body;

      const updated = await new BillingService(auth).updateTrainerBilling(id, {
        status,
        invoiceId,
        invoiceNumber,
        dueDate,
        paidAt,
        notes,
      });

      return NextResponse.json({ success: true, trainerBilling: updated });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Trainer billing update error:', error);
      return internalErrorResponse();
    }
  });
}

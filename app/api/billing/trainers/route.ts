import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { BillingService } from '@/src/application/services/billing.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:billing:trainers');

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Legt eine Honorarabrechnung für einen frei wählbaren `trainerId` mit
    // frei wählbarem Betrag an — eine Admin-Operation. Stand vorher auf
    // 'trainer', womit sich jeder Trainer selbst hätte abrechnen können.
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    // Rate limit
    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await _request.json();

      const {
        billingPeriodId,
        trainerId,
        trainerName,
        totalHours,
        hourlyRate,
        totalAmount,
        dueDate,
        notes,
      } = body;

      if (
        !billingPeriodId ||
        !trainerId ||
        !trainerName ||
        !totalHours ||
        !hourlyRate ||
        !totalAmount
      ) {
        return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400 });
      }

      // Übungsleiterpauschale (§ 3 Nr. 26 EStG): Berechnung sitzt jetzt in
      // BillingService.createTrainerBilling (Repository-Umstellung ADR-005).
      const trainerBilling = await new BillingService(auth).createTrainerBilling({
        billing_period_id: billingPeriodId,
        trainer_id: trainerId,
        trainer_name: trainerName,
        total_hours: totalHours,
        hourly_rate: hourlyRate,
        total_amount: totalAmount,
        due_date: dueDate ?? null,
        notes: notes ?? null,
      });

      return NextResponse.json({ success: true, trainerBilling });
    } catch (error) {
      log.error('Trainer billing creation error:', error);
      return internalErrorResponse();
    }
  });
}

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Permission check
    // Alle Varianten dieses Endpoints liefern fremde Honorardaten: ohne
    // Parameter *alle* Trainer, mit `trainerId` einen frei wählbaren. Mit
    // `verifyRole(auth, 'trainer')` konnte damit jeder Trainer die Vergütung
    // aller Kollegen auslesen. Der Endpoint ist ein Admin-Werkzeug —
    // Trainer nutzen /api/trainer/billing, das über die Session scopt.
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    // Rate limit
    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { searchParams } = new URL(_request.url);
      const billingPeriodId = searchParams.get('billingPeriodId');
      const trainerId = searchParams.get('trainerId');
      const status = searchParams.get('status');
      const summary = searchParams.get('summary');

      const service = new BillingService(auth);

      if (summary && billingPeriodId) {
        const summary = await service.calculateBillingSummary(billingPeriodId);
        return NextResponse.json({ summary });
      }

      if (billingPeriodId) {
        const trainerBillings = await service.getTrainerBillingsByBillingPeriod(billingPeriodId);
        return NextResponse.json({ trainerBillings });
      }

      if (trainerId) {
        const trainerBillings = await service.getTrainerBillingsByTrainerId(trainerId);
        return NextResponse.json({ trainerBillings });
      }

      if (status) {
        const trainerBillings = await service.getAllTrainerBillings(status);
        return NextResponse.json({ trainerBillings });
      }

      // Get all trainer billings (RLS scopt auf den eigenen Verein)
      const trainerBillings = await service.getAllTrainerBillings();
      return NextResponse.json({ trainerBillings });
    } catch (error) {
      log.error('Trainer billing fetch error:', error);
      return internalErrorResponse();
    }
  });
}

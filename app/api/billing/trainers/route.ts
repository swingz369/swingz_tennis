import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
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
      return forbiddenResponse('Admin access required');
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
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // Übungsleiterpauschale (§ 3 Nr. 26 EStG): max. 3.000 € steuerfrei p.a.
      const ANNUAL_LIMIT = 3000;
      const currentYear = new Date().getFullYear();
      const { supabase } = auth;
      // ponytail: cast as any — tax_free_amount added via migration, not yet in generated types
      const { data: existingBillings } = await (supabase as any)
        .from('trainer_billings')
        .select('tax_free_amount, created_at')
        .eq('trainer_id', trainerId)
        .not('status', 'eq', 'overdue');
      const usedThisYear = (
        (existingBillings ?? []) as Array<{ tax_free_amount: number; created_at: string }>
      )
        .filter((b) => new Date(b.created_at).getFullYear() === currentYear)
        .reduce((sum, b) => sum + Number(b.tax_free_amount), 0);
      const remaining = Math.max(0, ANNUAL_LIMIT - usedThisYear);
      const taxFreeAmount = Math.min(Number(totalAmount), remaining);
      const taxableAmount = Number(totalAmount) - taxFreeAmount;

      // Create trainer billing
      const trainerBilling = await BillingService.createTrainerBilling({
        billingPeriodId,
        trainerId,
        trainerName,
        totalHours,
        hourlyRate,
        totalAmount,
        taxFreeAmount,
        taxableAmount,
        dueDate,
        notes,
      });

      return NextResponse.json({ success: true, trainerBilling });
    } catch (error) {
      log.error('Trainer billing creation error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
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
      return forbiddenResponse('Admin access required');
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

      if (summary && billingPeriodId) {
        const summary = await BillingService.calculateBillingSummary(billingPeriodId);
        return NextResponse.json({ summary });
      }

      if (billingPeriodId) {
        const trainerBillings =
          await BillingService.getTrainerBillingsByBillingPeriod(billingPeriodId);
        return NextResponse.json({ trainerBillings });
      }

      if (trainerId) {
        const trainerBillings = await BillingService.getTrainerBillingsByTrainerId(trainerId);
        return NextResponse.json({ trainerBillings });
      }

      if (status) {
        const trainerBillings = await BillingService.getAllTrainerBillings(status);
        return NextResponse.json({ trainerBillings });
      }

      // Get all trainer billings
      const trainerBillings = await BillingService.getAllTrainerBillings();
      return NextResponse.json({ trainerBillings });
    } catch (error) {
      log.error('Trainer billing fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, rateLimitStrict, checkRateLimitOrFail } from '@/lib/rate-limit';
import { BillingService } from '@/src/application/services/billing.service';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    try {
      await checkRateLimitOrFail(_request, rateLimit);

      const isAdmin = await verifyRole(auth, 'admin');
      const isTrainer = await verifyRole(auth, 'trainer');
      if (!isAdmin && !isTrainer) {
        return forbiddenResponse('Admin or trainer access required');
      }

      const { id } = await params;
      const trainerBilling = await BillingService.getTrainerBillingById(id);

      if (!trainerBilling) {
        return NextResponse.json({ error: 'Trainer billing not found' }, { status: 404 });
      }

      return NextResponse.json({ trainerBilling });
    } catch (error) {
      console.error('Trainer billing fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    try {
      await checkRateLimitOrFail(_request, rateLimitStrict);

      const isAdmin = await verifyRole(auth, 'admin');
      const isTrainer = await verifyRole(auth, 'trainer');
      if (!isAdmin && !isTrainer) {
        return forbiddenResponse('Admin or trainer access required');
      }

      const { id } = await params;
      const body = await _request.json();

      const { status, invoiceId, invoiceNumber, dueDate, paidAt, notes } = body;

      const updated = await BillingService.updateTrainerBilling(id, {
        status,
        invoiceId,
        invoiceNumber,
        dueDate,
        paidAt,
        notes,
      });

      if (!updated) {
        return NextResponse.json({ error: 'Trainer billing not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, trainerBilling: updated });
    } catch (error) {
      console.error('Trainer billing update error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

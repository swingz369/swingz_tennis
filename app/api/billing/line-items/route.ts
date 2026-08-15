import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { BillingService } from '@/src/application/services/billing.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:billing:line-items');

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Permission check
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
    }

    // Rate limit
    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { searchParams } = new URL(_request.url);
      const trainerBillingId = searchParams.get('trainerBillingId');

      if (trainerBillingId) {
        const billingLineItems =
          await BillingService.getBillingLineItemsByTrainerBilling(trainerBillingId);
        return NextResponse.json({ billingLineItems });
      }

      // Get all billing line items
      const billingLineItems = await BillingService.getAllBillingLineItems();
      return NextResponse.json({ billingLineItems });
    } catch (error) {
      log.error('Billing line items fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Permission check
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
    }

    // Rate limit
    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      // Implement POST logic here if needed

      return NextResponse.json({ success: true });
    } catch (error) {
      log.error('Billing line items creation error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

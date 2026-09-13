import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { BillingService } from '@/src/application/services/billing.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:billing:line-items');

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Wie /api/billing/trainers: ohne `trainerBillingId` liefert der Endpoint
    // *alle* Abrechnungspositionen (Stunden, Sätze, Beschreibungen) aller
    // Trainer — mit `verifyRole(auth, 'trainer')` konnte damit jeder Trainer
    // die Detaildaten aller Kollegen auslesen. Admin-Werkzeug, kein Frontend
    // ruft diesen Endpoint aktuell als Trainer auf.
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
      const trainerBillingId = searchParams.get('trainerBillingId');
      const service = new BillingService(auth);

      if (trainerBillingId) {
        const billingLineItems =
          await service.getBillingLineItemsByTrainerBilling(trainerBillingId);
        return NextResponse.json({ billingLineItems });
      }

      // Get all billing line items (RLS scopt auf den eigenen Verein)
      const billingLineItems = await service.getAllBillingLineItems();
      return NextResponse.json({ billingLineItems });
    } catch (error) {
      log.error('Billing line items fetch error:', error);
      return internalErrorResponse();
    }
  });
}

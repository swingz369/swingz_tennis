import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { BillingService } from '@/src/application/services/billing.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:billing:trainers:[id]:pay');

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    try {
      await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);

      // Angeglichen an die Schwester-Routen ([id], [id]/overdue): Admin verwaltet
      // die Trainer-Abrechnung seines Vereins — superadmin war hier ein Ausreißer.
      const hasPermission = await verifyRole(auth, 'admin');
      if (!hasPermission) {
        return forbiddenResponse('Zugriff nur für Admins');
      }

      const { id } = await params;
      const updated = await BillingService.markTrainerBillingAsPaid(id);

      if (!updated) {
        return NextResponse.json({ error: 'Trainer-Abrechnung nicht gefunden' }, { status: 404 });
      }

      return NextResponse.json({ success: true, trainerBilling: updated });
    } catch (error) {
      log.error('Trainer billing payment error:', error);
      return internalErrorResponse();
    }
  });
}

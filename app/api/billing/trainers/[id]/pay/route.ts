import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { BillingService } from '@/src/application/services/billing.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:billing:trainers:[id]:pay');

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    try {
      await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);

      const hasPermission = await verifyRole(auth, 'superadmin');
      if (!hasPermission) {
        return forbiddenResponse('Superadmin access required');
      }

      const { id } = await params;
      const updated = await BillingService.markTrainerBillingAsPaid(id);

      if (!updated) {
        return NextResponse.json({ error: 'Trainer billing not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, trainerBilling: updated });
    } catch (error) {
      log.error('Trainer billing payment error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

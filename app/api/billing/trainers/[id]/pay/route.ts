import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimitStrict, checkRateLimitOrFail } from '@/lib/rate-limit';
import { BillingService } from '@/src/application/services/billing.service';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    try {
      await checkRateLimitOrFail(_request, rateLimitStrict);

      const hasPermission = await verifyRole(auth, 'admin');
      if (!hasPermission) {
        return forbiddenResponse('Admin access required');
      }

      const { id } = await params;
      const updated = await BillingService.markTrainerBillingAsPaid(id);

      if (!updated) {
        return NextResponse.json({ error: 'Trainer billing not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, trainerBilling: updated });
    } catch (error) {
      console.error('Trainer billing payment error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

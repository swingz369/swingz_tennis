import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';
import { BillingService } from '@/src/application/services/billing.service';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    try {
      await checkRateLimitOrFail(_request, rateLimit);

      const isAdmin = await verifyRole(auth, 'admin');
      const isTrainer = await verifyRole(auth, 'trainer');
      if (!isAdmin && !isTrainer) {
        return forbiddenResponse('Admin or trainer access required');
      }

      const { id } = await params;
      const updated = await BillingService.markTrainerBillingAsOverdue(id);

      if (!updated) {
        return NextResponse.json({ error: 'Trainer billing not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, trainerBilling: updated });
    } catch (error) {
      console.error('Trainer billing overdue error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

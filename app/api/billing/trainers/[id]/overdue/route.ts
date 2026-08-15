import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { BillingService } from '@/src/application/services/billing.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:billing:trainers:[id]:overdue');

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    try {
      await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);

      const isAdmin = await verifyRole(auth, 'admin');
      const isTrainer = await verifyRole(auth, 'trainer');
      if (!isAdmin && !isTrainer) {
        return forbiddenResponse('Zugriff nur für Admins oder Trainer');
      }

      const { id } = await params;
      const updated = await BillingService.markTrainerBillingAsOverdue(id);

      if (!updated) {
        return NextResponse.json({ error: 'Trainer billing not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, trainerBilling: updated });
    } catch (error) {
      log.error('Trainer billing overdue error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

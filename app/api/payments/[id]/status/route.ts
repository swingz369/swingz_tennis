import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { billingEngine } from '@/lib/billing-engine';
import type { PaymentStatus } from '@/lib/types/billing';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:payments:[id]:status');

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const body = await _request.json();
      const { status } = body;

      if (!status) {
        return NextResponse.json({ error: 'Status erforderlich' }, { status: 400 });
      }

      const payment = await billingEngine.updatePaymentStatus(id, status as PaymentStatus);

      return NextResponse.json({ payment });
    } catch (error) {
      log.error('Error updating payment status:', error);
      return NextResponse.json(
        { error: 'Zahlungsstatus konnte nicht aktualisiert werden' },
        { status: 500 }
      );
    }
  });
}

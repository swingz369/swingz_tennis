import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, verifyClubAccess, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { billingEngine } from '@/lib/billing-engine';
import { PaymentStatus } from '@/lib/types/billing';
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
      const parsed = PaymentStatus.safeParse(body?.status);

      if (!parsed.success) {
        return NextResponse.json({ error: 'Ungültiger Status' }, { status: 400 });
      }

      // Zahlungen haben keine club_id — der Verein kommt von der Rechnung.
      // Fremde Zahlung = "nicht gefunden": Existenz nicht verraten.
      const existing = await billingEngine.getPaymentById(id);
      const invoice = existing ? await billingEngine.getInvoiceById(existing.invoice_id) : null;
      if (!invoice || !verifyClubAccess(auth, invoice.club_id)) {
        return NextResponse.json({ error: 'Zahlung nicht gefunden' }, { status: 404 });
      }

      const payment = await billingEngine.updatePaymentStatus(id, parsed.data);

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

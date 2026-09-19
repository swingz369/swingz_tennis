import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { loadClubCreditor } from '@/lib/billing/club-creditor';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { billingEngine } from '@/lib/billing-engine';
import type { SepaPain008Config } from '@/lib/sepa/pain008-generator';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:billing:sepa:pain008');

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    try {
      await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);

      const hasPermission = await verifyRole(auth, 'admin');
      if (!hasPermission) {
        return forbiddenResponse('Zugriff nur für Admins');
      }

      const body = await _request.json();
      const { paymentIds, executionDate } = body;

      if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
        return NextResponse.json(
          { error: 'paymentIds muss ein nicht-leeres Array sein' },
          { status: 400 }
        );
      }

      if (paymentIds.length > 1000) {
        return NextResponse.json(
          { error: 'Maximal 1000 Zahlungen pro Export erlaubt' },
          { status: 400 }
        );
      }

      // Validate that all payments exist and belong to authorized club
      const payments = await Promise.all(
        paymentIds.map((id: string) => billingEngine.getPaymentById(id))
      );
      const validPayments = payments.filter((p) => p !== null);

      if (validPayments.length === 0) {
        return NextResponse.json({ error: 'Keine gültigen Zahlungen gefunden' }, { status: 404 });
      }

      if (validPayments.length !== paymentIds.length) {
        return NextResponse.json(
          { error: 'Einige Zahlungen wurden nicht gefunden' },
          { status: 404 }
        );
      }

      // Verify club ownership via invoice lookup
      for (const payment of validPayments) {
        if (!payment!.invoice_id) {
          return NextResponse.json(
            { error: `Zahlung ${payment!.id} hat keine zugehörige Rechnung` },
            { status: 400 }
          );
        }
        const invoice = await billingEngine.getInvoiceById(payment!.invoice_id);
        if (!invoice) {
          return NextResponse.json(
            { error: `Rechnung ${payment!.invoice_id} nicht gefunden` },
            { status: 404 }
          );
        }
        if (invoice.club_id !== auth.clubId) {
          return NextResponse.json(
            { error: `Rechnung ${payment!.invoice_id} gehört nicht zu Ihrem Club` },
            { status: 403 }
          );
        }
      }

      // Gläubiger ist der Verein (IBAN + Gläubiger-ID aus den Vereinseinstellungen)
      const creditor = await loadClubCreditor(auth.supabase, auth.clubId!);
      if (!creditor) {
        return NextResponse.json(
          {
            error:
              'Für den Lastschrift-Export fehlen IBAN und Gläubiger-ID deines Vereins. Bitte unter Einstellungen → Rechtliches ergänzen.',
          },
          { status: 422 }
        );
      }
      const config: Partial<SepaPain008Config> = {
        ...creditor,
        executionDate: executionDate || undefined,
        batchBooking: true,
      };

      const { xml, fileName } = await billingEngine.generateSepaDirectDebit(paymentIds, config);

      // Mark payments as processing to prevent double-export
      await Promise.allSettled(
        validPayments.map((p) => billingEngine.updatePaymentStatus(p!.id, 'processing'))
      );

      return new NextResponse(xml, {
        headers: {
          'Content-Type': 'application/xml',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': xml.length.toString(),
        },
      });
    } catch (error) {
      log.error('Error generating SEPA Pain.008 XML:', error);
      return internalErrorResponse();
    }
  });
}

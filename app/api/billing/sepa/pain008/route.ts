import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { billingEngine } from '@/lib/billing-engine';
import type { SepaPain008Config } from '@/lib/sepa/pain008-generator';

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    try {
      await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);

      const hasPermission = await verifyRole(auth, 'superadmin');
      if (!hasPermission) {
        return forbiddenResponse('Superadmin access required');
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

      // Delegate SEPA XML generation to billing engine (handles mandate lookup internally)
      const config: Partial<SepaPain008Config> = {
        creditorName: process.env.SEPA_CREDITOR_NAME || 'SWINGZ Tennis Club',
        creditorAccountIban: process.env.SEPA_CREDITOR_IBAN || '',
        creditorId: process.env.SEPA_CREDITOR_ID || 'DE98ZZZ09999999999',
        executionDate: executionDate || undefined,
        batchBooking: true,
      };

      const bic = process.env.SEPA_CREDITOR_BIC;
      if (bic) config.creditorAccountBic = bic;

      const street = process.env.SEPA_CREDITOR_STREET;
      const city = process.env.SEPA_CREDITOR_CITY;
      const postalCode = process.env.SEPA_CREDITOR_POSTAL_CODE;
      const country = process.env.SEPA_CREDITOR_COUNTRY || 'DE';

      const addrStreet = street || undefined;
      const addrCity = city || undefined;
      const addrPostal = postalCode || undefined;
      const addrCountry = country || undefined;
      if (addrStreet || addrCity || addrPostal || addrCountry) {
        config.creditorAddress = {
          ...(addrStreet != null ? { street: addrStreet } : {}),
          ...(addrCity != null ? { city: addrCity } : {}),
          ...(addrPostal != null ? { postalCode: addrPostal } : {}),
          ...(addrCountry != null ? { country: addrCountry } : {}),
        };
      }

      if (!config.creditorAccountIban) {
        return NextResponse.json(
          { error: 'SEPA_CREDITOR_IBAN Umgebungsvariable ist erforderlich' },
          { status: 500 }
        );
      }

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
      console.error('Error generating SEPA Pain.008 XML:', error);
      const isDevelopment = process.env.NODE_ENV === 'development';
      const message =
        isDevelopment && error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

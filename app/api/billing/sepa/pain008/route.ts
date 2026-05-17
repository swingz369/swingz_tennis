import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { billingEngine } from '@/lib/billing-engine';
import type { SepaDirectDebitTransaction, SepaPain008Config } from '@/lib/sepa/pain008-generator';
import { generatePain008Xml, getPain008FileName } from '@/lib/sepa/pain008-generator';

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

      const clubPayments = validPayments.filter((p) => p.club_id === auth.clubId);

      if (clubPayments.length !== validPayments.length) {
        return NextResponse.json(
          { error: 'Einige Zahlungen gehören nicht zu Ihrem Club' },
          { status: 403 }
        );
      }

      const transactions: SepaDirectDebitTransaction[] = [];

      for (const payment of validPayments) {
        if (!payment.sepa_mandate_id) {
          return NextResponse.json(
            { error: `Zahlung ${payment.id} hat kein SEPA-Mandat` },
            { status: 400 }
          );
        }

        const mandate = await billingEngine.getSepaMandateById(payment.sepa_mandate_id);

        if (!mandate) {
          return NextResponse.json(
            { error: `SEPA-Mandat ${payment.sepa_mandate_id} nicht gefunden` },
            { status: 404 }
          );
        }

        if (mandate.status !== 'active') {
          return NextResponse.json(
            { error: `SEPA-Mandat ${payment.sepa_mandate_id} ist nicht aktiv` },
            { status: 400 }
          );
        }

        if (mandate.club_id !== auth.clubId) {
          return NextResponse.json(
            { error: `SEPA-Mandat ${payment.sepa_mandate_id} gehört nicht zu Ihrem Club` },
            { status: 403 }
          );
        }

        const invoice = payment.invoice_id
          ? await billingEngine.getInvoiceById(payment.invoice_id)
          : null;

        const paymentDate =
          payment.payment_date instanceof Date
            ? payment.payment_date.toISOString().split('T')[0]
            : new Date(payment.payment_date).toISOString().split('T')[0];

        const transaction: SepaDirectDebitTransaction = {
          paymentId: payment.id,
          mandateId: mandate.id,
          mandateReference: mandate.mandate_reference,
          creditorId: mandate.creditor_id,
          iban: mandate.iban,
          accountHolderName: mandate.account_holder_name,
          amount: payment.amount,
          currency: 'EUR',
          paymentDate,
          endToEndId: `SWINGZ-${payment.payment_number}`,
          remittanceInformation: invoice
            ? `Rechnung ${invoice.invoice_number}`
            : `Zahlung ${payment.payment_number}`,
        };

        if (mandate.bic) {
          transaction.bic = mandate.bic;
        }

        transactions.push(transaction);
      }

      const config: SepaPain008Config = {
        creditorName: process.env.SEPA_CREDITOR_NAME || 'SWINGZ Tennis Club',
        creditorAccountIban: process.env.SEPA_CREDITOR_IBAN || '',
        creditorId: process.env.SEPA_CREDITOR_ID || 'DE98ZZZ09999999999',
        executionDate: executionDate || undefined,
        batchBooking: true,
      };

      const bic = process.env.SEPA_CREDITOR_BIC;
      if (bic) {
        config.creditorAccountBic = bic;
      }

      const street = process.env.SEPA_CREDITOR_STREET;
      const city = process.env.SEPA_CREDITOR_CITY;
      const postalCode = process.env.SEPA_CREDITOR_POSTAL_CODE;
      const country = process.env.SEPA_CREDITOR_COUNTRY || 'DE';

      if (street || city || postalCode || country) {
        config.creditorAddress = {};
        if (street) config.creditorAddress.street = street;
        if (city) config.creditorAddress.city = city;
        if (postalCode) config.creditorAddress.postalCode = postalCode;
        if (country) config.creditorAddress.country = country;
      }

      if (!config.creditorAccountIban) {
        return NextResponse.json(
          { error: 'SEPA_CREDITOR_IBAN Umgebungsvariable ist erforderlich' },
          { status: 500 }
        );
      }

      const xml = generatePain008Xml(transactions, config);
      const fileName = getPain008FileName();

      // Mark payments as processing to prevent double-export
      const statusResults = await Promise.allSettled(
        validPayments.map((p) =>
          billingEngine.updatePaymentStatus(p.id, 'processing', {
            processed_at: new Date().toISOString(),
          })
        )
      );

      for (const result of statusResults) {
        if (result.status === 'rejected') {
          console.error('Failed to update payment status during SEPA export:', result.reason);
        }
      }

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

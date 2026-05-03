import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { billingEngine } from '@/lib/billing-engine';
import {
  generatePain008Xml,
  getPain008FileName,
  SepaDirectDebitTransaction,
  SepaPain008Config,
} from '@/lib/sepa/pain008-generator';
import { createClient } from '@/infrastructure/external/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth();

    const body = await request.json();
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

    const supabase = await createClient();

    const { data: membership, error: membershipError } = await supabase
      .from('user_club_memberships')
      .select('club_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Kein aktiver Club gefunden' },
        { status: 403 }
      );
    }

    if (!['admin', 'superadmin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Keine Berechtigung zum Exportieren von SEPA-Daten' },
        { status: 403 }
      );
    }

    const payments = await Promise.all(
      paymentIds.map((id: string) => billingEngine.getPaymentById(id))
    );

    const validPayments = payments.filter((p) => p !== null);

    if (validPayments.length === 0) {
      return NextResponse.json(
        { error: 'Keine gültigen Zahlungen gefunden' },
        { status: 404 }
      );
    }

    if (validPayments.length !== paymentIds.length) {
      return NextResponse.json(
        { error: 'Einige Zahlungen wurden nicht gefunden' },
        { status: 404 }
      );
    }

    const clubPayments = validPayments.filter((p) => p.club_id === membership.club_id);

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

      if (mandate.club_id !== membership.club_id) {
        return NextResponse.json(
          { error: `SEPA-Mandat ${payment.sepa_mandate_id} gehört nicht zu Ihrem Club` },
          { status: 403 }
        );
      }

      const invoice = payment.invoice_id
        ? await billingEngine.getInvoiceById(payment.invoice_id)
        : null;

      transactions.push({
        paymentId: payment.id,
        mandateId: mandate.id,
        mandateReference: mandate.mandate_reference,
        creditorId: mandate.creditor_id,
        iban: mandate.iban,
        bic: mandate.bic || undefined,
        accountHolderName: mandate.account_holder_name,
        amount: payment.amount,
        currency: payment.currency || 'EUR',
        paymentDate: payment.payment_date,
        endToEndId: `SWINGZ-${payment.payment_number}`,
        remittanceInformation: invoice
          ? `Rechnung ${invoice.invoice_number}`
          : `Zahlung ${payment.payment_number}`,
      });
    }

    const config: SepaPain008Config = {
      creditorName: process.env.SEPA_CREDITOR_NAME || 'SWINGZ Tennis Club',
      creditorAccountIban: process.env.SEPA_CREDITOR_IBAN || '',
      creditorAccountBic: process.env.SEPA_CREDITOR_BIC || undefined,
      creditorId: process.env.SEPA_CREDITOR_ID || 'DE98ZZZ09999999999',
      creditorAddress: {
        street: process.env.SEPA_CREDITOR_STREET || undefined,
        city: process.env.SEPA_CREDITOR_CITY || undefined,
        postalCode: process.env.SEPA_CREDITOR_POSTAL_CODE || undefined,
        country: process.env.SEPA_CREDITOR_COUNTRY || 'DE',
      },
      executionDate: executionDate || undefined,
      batchBooking: true,
    };

    if (!config.creditorAccountIban) {
      return NextResponse.json(
        { error: 'SEPA_CREDITOR_IBAN Umgebungsvariable ist erforderlich' },
        { status: 500 }
      );
    }

    const xml = generatePain008Xml(transactions, config);
    const fileName = getPain008FileName();

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
    const message = isDevelopment && error instanceof Error
      ? error.message
      : 'Ein Fehler ist aufgetreten';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

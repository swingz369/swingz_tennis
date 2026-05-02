import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { billingEngine } from '@/lib/billing-engine';
import { generatePain008Xml, createSepaDirectDebitData, validateSepaDirectDebitData } from '@/lib/sepa/pain008-xml';

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const body = await request.json();
    
    const { clubId, paymentIds } = body;

    if (!clubId || !paymentIds || !Array.isArray(paymentIds)) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const payments = await Promise.all(
      paymentIds.map(async (paymentId: string) => {
        const { data: payment } = await billingEngine.getPaymentById(paymentId);
        return payment;
      })
    );

    const validPayments = payments.filter(p => p && p.payment_method === 'sepa' && p.status === 'pending');

    if (validPayments.length === 0) {
      return NextResponse.json(
        { error: 'No valid SEPA payments found' },
        { status: 400 }
      );
    }

    const mandateIds = validPayments
      .map(p => p.sepa_mandate_id)
      .filter((id): id is string => id !== undefined);

    const mandates = await Promise.all(
      mandateIds.map(async (mandateId) => {
        const { data: mandate } = await billingEngine.getSepaMandateById(mandateId);
        return mandate;
      })
    );

    const creditorName = process.env.SEPA_CREDITOR_NAME || 'SWINGZ Tennis Club';
    const creditorIban = process.env.SEPA_CREDITOR_IBAN || '';
    const creditorBic = process.env.SEPA_CREDITOR_BIC || '';
    const creditorId = process.env.SEPA_CREDITOR_ID || '';

    const sepaData = createSepaDirectDebitData(
      validPayments,
      mandates,
      creditorName,
      creditorIban,
      creditorBic,
      creditorId
    );

    const validation = validateSepaDirectDebitData(sepaData);

    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid SEPA data', details: validation.errors },
        { status: 400 }
      );
    }

    const xml = generatePain008Xml(sepaData);

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="sepa-direct-debit-${Date.now()}.xml"`,
        'Content-Length': xml.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating SEPA XML:', error);
    return NextResponse.json(
      { error: 'Failed to generate SEPA XML' },
      { status: 500 }
    );
  }
}

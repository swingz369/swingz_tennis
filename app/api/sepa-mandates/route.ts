import { NextRequest, NextResponse } from 'next/server';
import { SEPAMandateService } from '@/src/application/services/sepa-mandate.service';

export async function POST(___request: NextRequest) {
  try {
    const body = await __request.json();

    const {
      memberId,
      accountHolder,
      iban,
      bic,
      bankName,
      street,
      houseNumber,
      postalCode,
      city,
      mandateReference,
      signatureDate,
    } = body;

    if (!memberId) {
      return NextResponse.json(
        { error: 'Member ID is required' },
        { status: 400 }
      );
    }

    // Validate mandate data
    const validation = SEPAMandateService.validateMandateData({
      accountHolder,
      iban,
      bic,
      bankName,
      street,
      houseNumber,
      postalCode,
      city,
      signatureDate,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // Create mandate
    const mandate = await SEPAMandateService.createMandate(memberId, {
      accountHolder,
      iban,
      bic,
      bankName,
      street,
      houseNumber,
      postalCode,
      city,
      mandateReference,
      signatureDate,
    });

    return NextResponse.json({ success: true, mandate });
  } catch (error) {
    console.error('SEPA mandate creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(___request: NextRequest) {
  try {
    const { searchParams } = new URL(__request.url);
    const memberId = searchParams.get('memberId');
    const mandateId = searchParams.get('mandateId');

    if (mandateId) {
      const mandate = await SEPAMandateService.getMandateById(mandateId);
      if (!mandate) {
        return NextResponse.json(
          { error: 'Mandate not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ mandate });
    }

    if (memberId) {
      const mandates = await SEPAMandateService.getAllMandatesForMember(memberId);
      return NextResponse.json({ mandates });
    }

    return NextResponse.json(
      { error: 'Member ID or Mandate ID is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('SEPA mandate fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
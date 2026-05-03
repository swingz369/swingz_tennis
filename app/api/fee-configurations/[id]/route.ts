import { NextRequest, NextResponse } from 'next/server';
import { FeeConfigurationService } from '@/src/application/services/fee-configuration.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const feeConfiguration = await FeeConfigurationService.getFeeConfigurationById(params.id);

    if (!feeConfiguration) {
      return NextResponse.json(
        { error: 'Fee configuration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ feeConfiguration });
  } catch (error) {
    console.error('Fee configuration fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const {
      name,
      description,
      type,
      amount,
      currency,
      billingCycle,
      isActive,
      validFrom,
      validUntil,
      conditions,
    } = body;

    const updated = await FeeConfigurationService.updateFeeConfiguration(params.id, {
      name,
      description,
      type,
      amount,
      currency,
      billingCycle,
      isActive,
      validFrom,
      validUntil,
      conditions,
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Fee configuration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, feeConfiguration: updated });
  } catch (error) {
    console.error('Fee configuration update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const success = await FeeConfigurationService.deleteFeeConfiguration(params.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Fee configuration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Fee configuration delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

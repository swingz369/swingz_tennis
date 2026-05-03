import { NextRequest, NextResponse } from 'next/server';
import { PaymentSettingsService } from '@/src/application/services/payment-settings.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const paymentSettings = await PaymentSettingsService.getPaymentSettingsById(params.id);

    if (!paymentSettings) {
      return NextResponse.json(
        { error: 'Payment settings not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ paymentSettings });
  } catch (error) {
    console.error('Payment settings fetch error:', error);
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
      gatewayName,
      isActive,
      isDefault,
      config,
      supportedCurrencies,
      supportedMethods,
      minAmount,
      maxAmount,
      fees,
    } = body;

    const updated = await PaymentSettingsService.updatePaymentSettings(params.id, {
      gatewayName,
      isActive,
      isDefault,
      config,
      supportedCurrencies,
      supportedMethods,
      minAmount,
      maxAmount,
      fees,
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Payment settings not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, paymentSettings: updated });
  } catch (error) {
    console.error('Payment settings update error:', error);
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
    const success = await PaymentSettingsService.deletePaymentSettings(params.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Payment settings not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Payment settings delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

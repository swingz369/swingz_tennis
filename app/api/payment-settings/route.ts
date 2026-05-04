import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, rateLimitStrict, checkRateLimitOrFail } from '@/lib/rate-limit';
import { PaymentSettingsService } from '@/src/application/services/payment-settings.service';

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, rateLimitStrict);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await _request.json();

      const {
        gateway,
        gatewayName,
        config,
        supportedCurrencies,
        supportedMethods,
        minAmount,
        maxAmount,
        fees,
      } = body;

      if (!gateway || !gatewayName || !supportedCurrencies || !supportedMethods) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const paymentSettings = await PaymentSettingsService.createPaymentSettings({
        gateway,
        gatewayName,
        config,
        supportedCurrencies,
        supportedMethods,
        minAmount,
        maxAmount,
        fees,
      });

      return NextResponse.json({ success: true, paymentSettings });
    } catch (error) {
      console.error('Payment settings creation error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, rateLimit);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { searchParams } = new URL(_request.url);
      const gateway = searchParams.get('gateway');
      const active = searchParams.get('active');
      const isDefault = searchParams.get('default');

      if (isDefault) {
        const paymentSettings = await PaymentSettingsService.getDefaultPaymentSettings();
        return NextResponse.json({ paymentSettings });
      }

      if (active) {
        const paymentSettings = await PaymentSettingsService.getActivePaymentSettings();
        return NextResponse.json({ paymentSettings });
      }

      if (
        gateway &&
        (gateway === 'cash' ||
          gateway === 'sepa' ||
          gateway === 'stripe' ||
          gateway === 'paypal' ||
          gateway === 'other')
      ) {
        const paymentSettings = await PaymentSettingsService.getPaymentSettingsByGateway(gateway);
        return NextResponse.json({ paymentSettings });
      }

      const paymentSettings = await PaymentSettingsService.getAllPaymentSettings();
      return NextResponse.json({ paymentSettings });
    } catch (error) {
      console.error('Payment settings fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

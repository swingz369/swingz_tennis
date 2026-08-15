import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { paymentSettingsService } from '@/src/application/services/payment-settings-service.adapter';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:payment-settings');

export async function POST(_request: NextRequest) {
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

      const paymentSettings = await paymentSettingsService.createPaymentSettings({
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
      log.error('Payment settings creation error:', error);
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
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { searchParams } = new URL(_request.url);
      const gateway = searchParams.get('gateway');
      const active = searchParams.get('active');
      const isDefault = searchParams.get('default');

      if (isDefault) {
        const paymentSettings = await paymentSettingsService.getDefaultPaymentSettings();
        return NextResponse.json({ paymentSettings });
      }

      if (active) {
        const paymentSettings = await paymentSettingsService.getActivePaymentSettings();
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
        const paymentSettings = await paymentSettingsService.getPaymentSettingsByGateway(gateway);
        return NextResponse.json({ paymentSettings });
      }

      const paymentSettings = await paymentSettingsService.getAllPaymentSettings();
      return NextResponse.json({ paymentSettings });
    } catch (error) {
      log.error('Payment settings fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

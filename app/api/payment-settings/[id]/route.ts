import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { paymentSettingsService } from '@/src/application/services/payment-settings-service.adapter';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:payment-settings:[id]');

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      const { id } = await params;
      const paymentSettings = await paymentSettingsService.getPaymentSettingsById(id);

      if (!paymentSettings) {
        return NextResponse.json(
          { error: 'Zahlungseinstellungen nicht gefunden' },
          { status: 404 }
        );
      }

      return NextResponse.json({ paymentSettings });
    } catch (error) {
      log.error('Payment settings fetch error:', error);
      return internalErrorResponse();
    }
  });
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      const { id } = await params;
      const body = await _request.json();

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

      const updated = await paymentSettingsService.updatePaymentSettings(id, {
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
          { error: 'Zahlungseinstellungen nicht gefunden' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, paymentSettings: updated });
    } catch (error) {
      log.error('Payment settings update error:', error);
      return internalErrorResponse();
    }
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      const { id } = await params;
      const success = await paymentSettingsService.deletePaymentSettings(id);

      if (!success) {
        return NextResponse.json(
          { error: 'Zahlungseinstellungen nicht gefunden' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      log.error('Payment settings delete error:', error);
      return internalErrorResponse();
    }
  });
}

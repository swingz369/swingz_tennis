import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  errorResponse,
  internalErrorResponse,
  ApiException,
  safeErrorMessage,
} from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { PaymentSettingsService } from '@/application/services/payment-settings.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:payment-settings');

const gatewaySchema = z.enum(['stripe', 'paypal', 'sepa', 'cash', 'other']);

const feesSchema = z
  .object({
    fixed: z.number().nonnegative().optional(),
    percentage: z.number().min(0).max(100).optional(),
  })
  .optional();

const createPaymentSettingsSchema = z
  .object({
    gateway: gatewaySchema,
    gateway_name: z.string().min(2),
    config: z.record(z.string(), z.unknown()),
    supported_currencies: z.array(z.string()).min(1),
    supported_methods: z.array(z.string()).min(1),
    min_amount: z.number().nonnegative().optional(),
    max_amount: z.number().nonnegative().optional(),
    fees: feesSchema,
  })
  .refine(
    (v) => v.min_amount === undefined || v.max_amount === undefined || v.min_amount <= v.max_amount,
    {
      message: 'Mindestbetrag darf nicht größer als Höchstbetrag sein',
      path: ['min_amount'],
    }
  );

export async function POST(request: NextRequest) {
  return withApiAuth(
    request,
    async (auth, body) => {
      const hasPermission = await verifyRole(auth, 'admin');
      if (!hasPermission) {
        return forbiddenResponse('Zugriff nur für Admins');
      }
      if (!auth.clubId) {
        return forbiddenResponse('Kein aktiver Verein ausgewählt');
      }

      const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
      if (rateLimitError) {
        return rateLimitError;
      }

      try {
        const paymentSettings = await new PaymentSettingsService(auth).createPaymentSettings(
          auth.clubId,
          body
        );
        return NextResponse.json({ success: true, paymentSettings });
      } catch (error) {
        if (error instanceof ApiException) {
          return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
        }
        log.error('Payment settings creation error:', error);
        return internalErrorResponse();
      }
    },
    { body: createPaymentSettingsSchema }
  );
}

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }
    if (!auth.clubId) {
      return forbiddenResponse('Kein aktiver Verein ausgewählt');
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { searchParams } = new URL(request.url);
      const gateway = searchParams.get('gateway');
      const active = searchParams.get('active');
      const isDefault = searchParams.get('default');
      const service = new PaymentSettingsService(auth);

      if (isDefault) {
        const paymentSettings = await service.getDefaultPaymentSettings(auth.clubId);
        return NextResponse.json({ paymentSettings });
      }

      if (active) {
        const paymentSettings = await service.getActivePaymentSettings(auth.clubId);
        return NextResponse.json({ paymentSettings });
      }

      const parsedGateway = gatewaySchema.safeParse(gateway);
      if (parsedGateway.success) {
        const paymentSettings = await service.getPaymentSettingsByGateway(
          parsedGateway.data,
          auth.clubId
        );
        return NextResponse.json({ paymentSettings });
      }

      const paymentSettings = await service.getAllPaymentSettings(auth.clubId);
      return NextResponse.json({ paymentSettings });
    } catch (error) {
      log.error('Payment settings fetch error:', error);
      return internalErrorResponse();
    }
  });
}

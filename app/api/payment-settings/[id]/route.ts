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

const log = createLogger('api:payment-settings:[id]');

const updatePaymentSettingsSchema = z.object({
  gateway_name: z.string().min(2).optional(),
  is_active: z.boolean().optional(),
  is_default: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  supported_currencies: z.array(z.string()).min(1).optional(),
  supported_methods: z.array(z.string()).min(1).optional(),
  min_amount: z.number().nonnegative().optional(),
  max_amount: z.number().nonnegative().optional(),
  fees: z
    .object({
      fixed: z.number().nonnegative().optional(),
      percentage: z.number().min(0).max(100).optional(),
    })
    .optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      const { id } = await params;
      const paymentSettings = await new PaymentSettingsService(auth).getPaymentSettingsById(
        id,
        auth.clubId
      );
      return NextResponse.json({ paymentSettings });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Payment settings fetch error:', error);
      return internalErrorResponse();
    }
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
        const { id } = await params;
        const updated = await new PaymentSettingsService(auth).updatePaymentSettings(
          id,
          auth.clubId,
          body
        );
        return NextResponse.json({ success: true, paymentSettings: updated });
      } catch (error) {
        if (error instanceof ApiException) {
          return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
        }
        log.error('Payment settings update error:', error);
        return internalErrorResponse();
      }
    },
    { body: updatePaymentSettingsSchema }
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(request, async (auth) => {
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
      const { id } = await params;
      await new PaymentSettingsService(auth).deletePaymentSettings(id, auth.clubId);
      return NextResponse.json({ success: true });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Payment settings delete error:', error);
      return internalErrorResponse();
    }
  });
}

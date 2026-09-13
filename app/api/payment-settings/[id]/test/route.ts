import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  errorResponse,
  internalErrorResponse,
  ApiException,
  safeErrorMessage,
} from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { PaymentSettingsService } from '@/application/services/payment-settings.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:payment-settings:[id]:test');

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      const result = await new PaymentSettingsService(auth).testPaymentSettings(id, auth.clubId);
      return NextResponse.json({ success: true, message: result.message });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Payment settings test error:', error);
      return internalErrorResponse();
    }
  });
}

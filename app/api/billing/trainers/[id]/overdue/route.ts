import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  internalErrorResponse,
  ApiException,
  errorResponse,
  safeErrorMessage,
} from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { BillingService } from '@/src/application/services/billing.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:billing:trainers:[id]:overdue');

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    // Angeglichen an die Schwester-Route ([id]/pay): Admin verwaltet die
    // Trainer-Abrechnung seines Vereins. Vorher auch 'trainer' zugelassen —
    // damit hätte jeder Trainer jede fremde Abrechnung als überfällig
    // markieren können.
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    try {
      await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);

      const { id } = await params;
      const updated = await new BillingService(auth).markTrainerBillingAsOverdue(id);

      return NextResponse.json({ success: true, trainerBilling: updated });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('Trainer billing overdue error:', error);
      return internalErrorResponse();
    }
  });
}

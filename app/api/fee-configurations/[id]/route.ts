import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { FeeConfigurationService } from '@/application/services/fee-configuration.service';
import { getUserDb } from '@/infrastructure/db';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:fee-configurations:[id]');

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) {
      return forbiddenResponse('Anmeldung erforderlich');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const feeConfiguration = await new FeeConfigurationService(getUserDb(auth)).get(id);

      if (!feeConfiguration) {
        return NextResponse.json(
          { error: 'Gebührenkonfiguration nicht gefunden' },
          { status: 404 }
        );
      }

      return NextResponse.json({ feeConfiguration });
    } catch (error) {
      log.error('Fee configuration fetch error:', error);
      return internalErrorResponse();
    }
  });
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
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

      const updated = await new FeeConfigurationService(getUserDb(auth)).update(id, {
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
          { error: 'Gebührenkonfiguration nicht gefunden' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, feeConfiguration: updated });
    } catch (error) {
      log.error('Fee configuration update error:', error);
      return internalErrorResponse();
    }
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const success = await new FeeConfigurationService(getUserDb(auth)).delete(id);

      if (!success) {
        return NextResponse.json(
          { error: 'Gebührenkonfiguration nicht gefunden' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      log.error('Fee configuration delete error:', error);
      return internalErrorResponse();
    }
  });
}

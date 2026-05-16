import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { FeeConfigurationService } from '@/src/application/services/fee-configuration.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) {
      return forbiddenResponse('Authentication required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const feeConfiguration = await FeeConfigurationService.getFeeConfigurationById(id);

      if (!feeConfiguration) {
        return NextResponse.json({ error: 'Fee configuration not found' }, { status: 404 });
      }

      return NextResponse.json({ feeConfiguration });
    } catch (error) {
      console.error('Fee configuration fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
      return forbiddenResponse('Admin access required');
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

      const updated = await FeeConfigurationService.updateFeeConfiguration(id, {
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
        return NextResponse.json({ error: 'Fee configuration not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, feeConfiguration: updated });
    } catch (error) {
      console.error('Fee configuration update error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
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
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const success = await FeeConfigurationService.deleteFeeConfiguration(id);

      if (!success) {
        return NextResponse.json({ error: 'Fee configuration not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Fee configuration delete error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

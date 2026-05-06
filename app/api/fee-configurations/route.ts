import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { FeeConfigurationService } from '@/src/application/services/fee-configuration.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, rateLimitStrict, checkRateLimitOrFail } from '@/lib/rate-limit';
import { z } from 'zod';

const createFeeConfigSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['membership', 'training', 'court', 'other']),
  amount: z.number().positive(),
  currency: z.string().default('EUR'),
  billingCycle: z.enum(['monthly', 'quarterly', 'yearly', 'one_time']),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  conditions: z.record(z.unknown()).optional(),
});

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Only admins can create fee configurations
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, rateLimitStrict);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await _request.json();

      const validation = createFeeConfigSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.issues },
          { status: 400 }
        );
      }

      const feeConfiguration = await FeeConfigurationService.createFeeConfiguration(
        validation.data
      );

      return NextResponse.json({ success: true, feeConfiguration });
    } catch (error) {
      console.error('Fee configuration creation error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Members can view fee configurations
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) {
      return forbiddenResponse('Authentication required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { searchParams } = new URL(_request.url);
      const type = searchParams.get('type');
      const billingCycle = searchParams.get('billingCycle');
      const active = searchParams.get('active');
      const memberType = searchParams.get('memberType');
      const memberAge = searchParams.get('memberAge');

      if (active && memberType && memberAge) {
        // Get all active configs and filter client-side for now
        // TODO: Implement getApplicableFeeConfigurations in service
        const allConfigs = await FeeConfigurationService.getAllFeeConfigurations();
        const configs = allConfigs.filter((c: { isActive: boolean }) => c.isActive);
        return NextResponse.json({ feeConfigurations: configs });
      }

      if (type) {
        const configs = await FeeConfigurationService.getFeeConfigurationsByType(
          type as 'membership' | 'training' | 'court' | 'other'
        );
        return NextResponse.json({ feeConfigurations: configs });
      }

      if (billingCycle) {
        const configs = await FeeConfigurationService.getFeeConfigurationsByBillingCycle(
          billingCycle as 'monthly' | 'quarterly' | 'yearly' | 'one_time'
        );
        return NextResponse.json({ feeConfigurations: configs });
      }

      const allConfigs = await FeeConfigurationService.getAllFeeConfigurations();
      return NextResponse.json({ feeConfigurations: allConfigs });
    } catch (error) {
      console.error('Fee configurations fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

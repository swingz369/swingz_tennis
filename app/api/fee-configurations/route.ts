import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { feeConfigurationService } from '@/src/application/services/fee-configuration-service.adapter';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { z } from 'zod';
import type { CreateFeeConfigurationInput } from '@/src/domain/entities/fee-configuration.entity';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:fee-configurations');

const createFeeConfigSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['membership', 'training', 'court', 'other']),
  amount: z.number().nonnegative(),
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
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    const clubId = auth.clubId;
    if (!clubId) {
      return NextResponse.json({ error: 'Kein Verein zugeordnet' }, { status: 400 });
    }

    try {
      const body = await _request.json();

      const validation = createFeeConfigSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validierung fehlgeschlagen', details: validation.error.issues },
          { status: 400 }
        );
      }

      const feeConfiguration = await feeConfigurationService.createFeeConfiguration(
        validation.data as CreateFeeConfigurationInput,
        clubId
      );

      return NextResponse.json({ success: true, feeConfiguration });
    } catch (error) {
      log.error('Fee configuration creation error:', error);
      return internalErrorResponse();
    }
  });
}

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Members can view fee configurations
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) {
      return forbiddenResponse('Anmeldung erforderlich');
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
        // Filter active configs by member type and age
        const memberAgeNum = parseInt(memberAge, 10);
        if (isNaN(memberAgeNum)) {
          return NextResponse.json({ error: 'Ungültiger memberAge-Parameter' }, { status: 400 });
        }
        const configs = await feeConfigurationService.calculateFeeForMember(
          memberType,
          memberAgeNum
        );
        return NextResponse.json({ feeConfigurations: configs });
      }

      if (type) {
        const configs = await feeConfigurationService.getFeeConfigurationsByType(
          type as 'membership' | 'training' | 'court' | 'other'
        );
        return NextResponse.json({ feeConfigurations: configs });
      }

      if (billingCycle) {
        const configs = await feeConfigurationService.getFeeConfigurationsByBillingCycle(
          billingCycle as 'monthly' | 'quarterly' | 'yearly' | 'one_time'
        );
        return NextResponse.json({ feeConfigurations: configs });
      }

      const allConfigs = await feeConfigurationService.getAllFeeConfigurations();
      return NextResponse.json({ feeConfigurations: allConfigs });
    } catch (error) {
      log.error('Fee configurations fetch error:', error);
      return internalErrorResponse();
    }
  });
}

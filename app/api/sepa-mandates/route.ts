import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { SEPAMandateService } from '@/src/application/services/sepa-mandate.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import type { ZodError } from 'zod';
import {
  CreateSEPAMandateSchema,
  validateRequestBody,
  formatValidationErrors,
} from '@/lib/validation-schemas';

export async function POST(request: NextRequest) {
  return withCSRFProtection(request, async () => {
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      try {
        // Only admin can create SEPA mandates
        const hasPermission = await verifyRole(auth, 'admin');
        if (!hasPermission) {
          return forbiddenResponse('Insufficient permissions to create SEPA mandates');
        }

        const body = await request.json();

        // Validate request body with Zod
        const validation = validateRequestBody(CreateSEPAMandateSchema, body);
        if (!validation.success) {
          const errors = (validation as { success: false; errors: ZodError }).errors;
          return NextResponse.json(
            {
              error: 'Validation failed',
              details: formatValidationErrors(errors),
            },
            { status: 400 }
          );
        }

        // Create mandate
        const mandate = await SEPAMandateService.createMandate(
          validation.data.memberId,
          validation.data
        );

        return NextResponse.json({ success: true, mandate });
      } catch (error) {
        console.error('SEPA mandate creation error:', error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Internal server error' },
          { status: 500 }
        );
      }
    });
  });
}

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    try {
      // Only admin and trainers can view SEPA mandates
      const hasPermission = await verifyRole(auth, 'trainer');
      if (!hasPermission) {
        return forbiddenResponse('Insufficient permissions to view SEPA mandates');
      }

      const { searchParams } = new URL(request.url);
      const memberId = searchParams.get('memberId');
      const mandateId = searchParams.get('mandateId');

      if (mandateId) {
        const mandate = await SEPAMandateService.getMandateById(mandateId);
        if (!mandate) {
          return NextResponse.json({ error: 'Mandate not found' }, { status: 404 });
        }
        return NextResponse.json({ mandate });
      }

      if (memberId) {
        const mandates = await SEPAMandateService.getAllMandatesForMember(memberId);
        return NextResponse.json({ mandates });
      }

      return NextResponse.json({ error: 'Member ID or Mandate ID is required' }, { status: 400 });
    } catch (error) {
      console.error('SEPA mandate fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

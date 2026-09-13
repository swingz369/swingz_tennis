import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  errorResponse,
  internalErrorResponse,
  ApiException,
  safeErrorMessage,
} from '@/lib/api-error';
import { SepaMandateService } from '@/application/services/sepa-mandate.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { createLogger } from '@/lib/logger';
import { CreateSEPAMandateSchema } from '@/lib/validation-schemas';

const log = createLogger('api:sepa-mandates');

const createMandateSchema = CreateSEPAMandateSchema.extend({
  memberId: CreateSEPAMandateSchema.shape.memberId.optional(),
});

export async function POST(request: NextRequest) {
  return withCSRFProtection(request, async () => {
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
    if (rateLimitError) return rateLimitError;

    return withApiAuth(
      request,
      async (auth, body) => {
        // Admin can create mandates for any member; members can only sign their own
        const isAdmin = await verifyRole(auth, 'admin');
        const isMember = await verifyRole(auth, 'member');
        if (!isAdmin && !isMember) {
          return forbiddenResponse('Keine Berechtigung zum Anlegen von SEPA-Mandaten');
        }

        if (!isAdmin && body.memberId && body.memberId !== auth.user.id) {
          return forbiddenResponse('Mitglieder können nur Mandate für sich selbst anlegen');
        }
        const memberId = isAdmin && body.memberId ? body.memberId : auth.user.id;

        try {
          const { memberId: _memberId, ...mandateData } = body;
          const mandate = await new SepaMandateService(auth).createMandate(memberId, mandateData);
          return NextResponse.json({ success: true, mandate });
        } catch (error) {
          if (error instanceof ApiException) {
            return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
          }
          log.error('SEPA mandate creation error:', error);
          return internalErrorResponse();
        }
      },
      { body: createMandateSchema }
    );
  });
}

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const mandateId = searchParams.get('mandateId');
    const active = searchParams.get('active');

    // Trainer und höher dürfen Mandate beliebiger Mitglieder nachschlagen. Ein
    // Mitglied darf genau eine Sache lesen: sein eigenes aktives Mandat — das
    // Gegenstück zu POST, das es bereits unterschreiben lässt. RLS erzwingt
    // die eigentliche Grenze (sepa_mandates_member_view_own / _admin_manage);
    // dieser Check ist die Vorabsperre auf App-Ebene.
    const isPrivileged = await verifyRole(auth, 'trainer');
    const readsOwnActiveMandate =
      active === 'true' && !mandateId && (!memberId || memberId === auth.user.id);
    if (!isPrivileged && !readsOwnActiveMandate) {
      return forbiddenResponse('Keine Berechtigung zum Anzeigen von SEPA-Mandaten');
    }

    try {
      const service = new SepaMandateService(auth);

      if (mandateId) {
        const mandate = await service.getMandateById(mandateId);
        return NextResponse.json({ mandate });
      }

      if (active === 'true') {
        const targetMemberId = memberId || auth.user.id;
        const activeMandate = await service.getActiveMandateForMember(targetMemberId);
        if (!activeMandate) {
          return NextResponse.json({ mandate: null, active: false });
        }
        return NextResponse.json({ mandate: activeMandate, active: true });
      }

      if (memberId) {
        const mandates = await service.getAllMandatesForMember(memberId);
        return NextResponse.json({ mandates });
      }

      return NextResponse.json({ error: 'Member-ID oder Mandat-ID erforderlich' }, { status: 400 });
    } catch (error) {
      if (error instanceof ApiException) {
        return errorResponse(error.code, safeErrorMessage(error), { status: error.status });
      }
      log.error('SEPA mandate fetch error:', error);
      return internalErrorResponse();
    }
  });
}

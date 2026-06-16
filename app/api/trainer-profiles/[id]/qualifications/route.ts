import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { trainerProfileService } from '@/src/application/services/trainer-profile-service.adapter';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:trainer-profiles:[id]:qualifications');

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer or admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const profile = await trainerProfileService.getTrainerProfileById(id);

      if (!profile) {
        return NextResponse.json({ error: 'Trainer profile not found' }, { status: 404 });
      }

      return NextResponse.json({ qualifications: profile.qualifications || [] });
    } catch (error) {
      log.error('Qualifications fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    const isTrainer = await verifyRole(auth, 'trainer');

    if (!isAdmin && !isTrainer) {
      return forbiddenResponse('Trainer or admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;

      if (!isAdmin) {
        const profile = await trainerProfileService.getTrainerProfileById(id);
        if (!profile || profile.userId !== auth.user.id) {
          return forbiddenResponse('You can only add qualifications to your own profile');
        }
      }

      const body = await _request.json();

      const { name, issuer, issuedDate, expiryDate, certificateUrl } = body;

      if (!name || !issuer || !issuedDate) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const updated = await trainerProfileService.addQualification(id, {
        name,
        issuer,
        issuedDate,
        expiryDate,
        certificateUrl,
      });

      if (!updated) {
        return NextResponse.json({ error: 'Trainer profile not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, trainerProfile: updated });
    } catch (error) {
      log.error('Qualification addition error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

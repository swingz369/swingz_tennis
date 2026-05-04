import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { TrainerProfileService } from '@/src/application/services/trainer-profile.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer or admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, rateLimit);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const profile = await TrainerProfileService.getTrainerProfileById(id);

      if (!profile) {
        return NextResponse.json({ error: 'Trainer profile not found' }, { status: 404 });
      }

      return NextResponse.json({ qualifications: profile.qualifications || [] });
    } catch (error) {
      console.error('Qualifications fetch error:', error);
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

    const rateLimitError = await checkRateLimitOrFail(_request, rateLimit);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;

      if (!isAdmin) {
        const profile = await TrainerProfileService.getTrainerProfileById(id);
        if (!profile || profile.userId !== auth.user.id) {
          return forbiddenResponse('You can only add qualifications to your own profile');
        }
      }

      const body = await _request.json();

      const { name, issuer, issuedDate, expiryDate, certificateUrl } = body;

      if (!name || !issuer || !issuedDate) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const updated = await TrainerProfileService.addQualification(id, {
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
      console.error('Qualification addition error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

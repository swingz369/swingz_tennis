import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { trialTrainingService } from '@/src/application/services/trial-training-service.adapter';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Authentication required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const trialTraining = await trialTrainingService.getTrialTrainingById(id);

      if (!trialTraining) {
        return NextResponse.json({ error: 'Trial training not found' }, { status: 404 });
      }

      return NextResponse.json({ trialTraining });
    } catch (error) {
      console.error('Trial training fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      const body = await _request.json();

      const {
        status,
        notes,
        feedback,
        convertedToMemberId,
        trainerId,
        trainerName,
        courtId,
        courtName,
      } = body;

      const updated = await trialTrainingService.updateTrialTraining(id, {
        status,
        notes,
        feedback,
        convertedToMemberId,
        trainerId,
        trainerName,
        courtId,
        courtName,
      });

      if (!updated) {
        return NextResponse.json({ error: 'Trial training not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, trialTraining: updated });
    } catch (error) {
      console.error('Trial training update error:', error);
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
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const success = await trialTrainingService.deleteTrialTraining(id);

      if (!success) {
        return NextResponse.json({ error: 'Trial training not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Trial training delete error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

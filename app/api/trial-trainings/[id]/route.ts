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

      // Auto-join: when trial training is completed, add participant as club member
      // if they have a user account (matches the onboarding Probetraining flow).
      // Note: updated.clubId is not on the TrialTraining entity, so we query the
      // DB directly for the club_id column.
      if (status === 'completed' && updated.participant?.email) {
        try {
          const { data: ttRow } = await auth.supabase
            .from('trial_trainings')
            .select('club_id, participant_email')
            .eq('id', id)
            .maybeSingle();

          const clubId = ttRow?.club_id;
          const participantEmail = ttRow?.participant_email ?? updated.participant.email;

          if (clubId && participantEmail) {
            // Find user by participant email
            const { data: existingUser } = await auth.supabase
              .from('users')
              .select('id')
              .eq('email', participantEmail.toLowerCase())
              .maybeSingle();

            if (existingUser) {
              // Check if membership already exists
              const { data: existingMembership } = await auth.supabase
                .from('user_club_memberships')
                .select('id')
                .eq('user_id', existingUser.id)
                .eq('club_id', clubId)
                .maybeSingle();

              if (!existingMembership) {
                await auth.supabase.from('user_club_memberships').insert({
                  user_id: existingUser.id,
                  club_id: clubId,
                  role: 'member',
                  is_active: true,
                });
                console.log(`[TrialTraining] Auto-joined ${participantEmail} to club ${clubId}`);
              }
            }
          }
        } catch (joinErr) {
          // Non-fatal: log but don't fail the trial training update
          console.error('[TrialTraining] Auto-join failed:', joinErr);
        }
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

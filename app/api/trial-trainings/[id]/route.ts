import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { TrialTrainingService } from '@/application/services/trial-training.service';
import { getUserDb } from '@/infrastructure/db';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { sendFollowupEmail } from '@/lib/trial-training/followup';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:trial-training');

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    // Nur Trainer/Admins sehen Interessenten-PII (Name, Telefon, Geburtsdatum)
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    const clubId = auth.clubId;
    if (!clubId) {
      return NextResponse.json({ error: 'Kein Verein zugeordnet' }, { status: 400 });
    }

    try {
      const { id } = await params;
      const trialTrainingService = new TrialTrainingService(getUserDb(auth));
      const trialTraining = await trialTrainingService.getTrialTrainingById(id, clubId);

      if (!trialTraining) {
        return NextResponse.json({ error: 'Probetraining nicht gefunden' }, { status: 404 });
      }

      return NextResponse.json({ trialTraining });
    } catch (error) {
      log.error('Trial training fetch error', error instanceof Error ? error : undefined);
      return internalErrorResponse();
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
      return forbiddenResponse('Zugriff nur für Trainer oder Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    const clubId = auth.clubId;
    if (!clubId) {
      return NextResponse.json({ error: 'Kein Verein zugeordnet' }, { status: 400 });
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

      const trialTrainingService = new TrialTrainingService(getUserDb(auth));
      const updated = await trialTrainingService.updateTrialTraining(
        id,
        {
          status,
          notes,
          feedback,
          convertedToMemberId,
          trainerId,
          trainerName,
          courtId,
          courtName,
        },
        clubId
      );

      if (!updated) {
        return NextResponse.json({ error: 'Probetraining nicht gefunden' }, { status: 404 });
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
                log.info('Auto-joined participant to club', { email: participantEmail, clubId });
              }
            }
          }
        } catch (joinErr) {
          // Non-fatal: log but don't fail the trial training update
          log.error('Auto-join failed', joinErr instanceof Error ? joinErr : undefined);
        }
      }

      // Nurture-Flow: Abschlusszeit + Fortschritt setzen und die „Danke"-Mail
      // (Feedback-Link + Anmeldelink) sofort senden. Erinnerung/letzter Anstoß
      // kommen später aus dem Cron (/api/cron/trial-followup).
      if (status === 'completed' && updated.participant?.email) {
        try {
          const { data: ttRow } = await auth.supabase
            .from('trial_trainings')
            .select(
              'club_id, participant_id, participant_email, participant_first_name, followup_stage'
            )
            .eq('id', id)
            .maybeSingle();

          // Idempotent: nur beim ersten Abschluss „Danke" senden.
          if (ttRow && ttRow.followup_stage === 0) {
            await auth.supabase
              .from('trial_trainings')
              .update({ completed_at: new Date().toISOString(), followup_stage: 1 })
              .eq('id', id);

            const { data: clubRow } = await auth.supabase
              .from('clubs')
              .select('name')
              .eq('id', ttRow.club_id)
              .maybeSingle();

            void sendFollowupEmail({
              to: ttRow.participant_email,
              name: ttRow.participant_first_name,
              clubName: clubRow?.name ?? 'Dein Tennisverein',
              kind: 'thanks',
              participantId: ttRow.participant_id,
            }).catch(() => {
              // Mail ist nicht kritisch — nicht den Statuswechsel blockieren.
            });
          }
        } catch (nurtureErr) {
          log.warn('Nurture setup failed (non-blocking)', nurtureErr);
        }
      }

      return NextResponse.json({ success: true, trialTraining: updated });
    } catch (error) {
      log.error('Trial training update error', error instanceof Error ? error : undefined);
      return internalErrorResponse();
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
      const { id } = await params;
      const trialTrainingService = new TrialTrainingService(getUserDb(auth));
      const success = await trialTrainingService.deleteTrialTraining(id, clubId);

      if (!success) {
        return NextResponse.json({ error: 'Probetraining nicht gefunden' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      log.error('Trial training delete error', error instanceof Error ? error : undefined);
      return internalErrorResponse();
    }
  });
}

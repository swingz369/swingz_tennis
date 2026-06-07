import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { trialTrainingService } from '@/src/application/services/trial-training-service.adapter';
import { EmailService } from '@/src/application/services/email.service';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const body = await _request.json();
      const { memberId, memberType, startDate, assignedGroup } = body;

      if (!memberId) {
        return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
      }

      const trialTraining = await trialTrainingService.getTrialTrainingById(id);

      if (!trialTraining) {
        return NextResponse.json({ error: 'Trial training not found' }, { status: 404 });
      }

      if (trialTraining.status !== 'completed') {
        return NextResponse.json(
          { error: 'Can only convert completed trial trainings' },
          { status: 400 }
        );
      }

      const updated = await trialTrainingService.convertTrialToMember(id, memberId);

      if (!updated) {
        return NextResponse.json({ error: 'Failed to convert trial training' }, { status: 500 });
      }

      try {
        // Fetch club contact details from system_settings
        const { data: settingRows } = await auth.supabase
          .from('system_settings')
          .select('key, value')
          .eq('club_id', auth.clubId ?? '')
          .in('key', ['club_address', 'club_phone', 'club_email', 'club_name']);
        const settings: Record<string, string> = {};
        for (const row of settingRows ?? []) {
          settings[row.key] = row.value;
        }

        await EmailService.sendWelcomeEmail({
          recipientName: `${trialTraining.participant.firstName} ${trialTraining.participant.lastName}`,
          recipientEmail: trialTraining.participant.email,
          clubName: settings['club_name'] ?? 'SwingZ Tennis Club',
          memberType: memberType || 'member',
          ...(startDate ? { startDate: new Date(startDate) } : {}),
          assignedGroup,
          clubAddress: settings['club_address'] ?? '',
          clubPhone: settings['club_phone'] ?? '',
          clubEmail: settings['club_email'] ?? '',
        });
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
      }

      return NextResponse.json({
        success: true,
        trialTraining: updated,
        message: 'Trial training converted to member successfully',
      });
    } catch (error) {
      console.error('Trial training conversion error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

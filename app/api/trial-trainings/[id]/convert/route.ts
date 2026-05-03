import { NextRequest, NextResponse } from 'next/server';
import { TrialTrainingService } from '@/src/application/services/trial-training.service';
import { EmailService } from '@/src/application/services/email.service';

export async function POST(
  _____request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await __request.json();
    const { memberId, memberType, startDate, assignedGroup } = body;

    if (!memberId) {
      return NextResponse.json(
        { error: 'Member ID is required' },
        { status: 400 }
      );
    }

    // Get trial training
    const trialTraining = await TrialTrainingService.getTrialTrainingById(id);

    if (!trialTraining) {
      return NextResponse.json(
        { error: 'Trial training not found' },
        { status: 404 }
      );
    }

    if (trialTraining.status !== 'completed') {
      return NextResponse.json(
        { error: 'Can only convert completed trial trainings' },
        { status: 400 }
      );
    }

    // Convert trial to member
    const updated = await TrialTrainingService.convertTrialToMember(id, memberId);

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to convert trial training' },
        { status: 500 }
      );
    }

    // Send welcome email to new member
    try {
      await EmailService.sendWelcomeEmail({
        recipientName: `${trialTraining.participant.firstName} ${trialTraining.participant.lastName}`,
        recipientEmail: trialTraining.participant.email,
        clubName: 'SwingZ Tennis Club',
        memberType: memberType || 'member',
        startDate: startDate ? new Date(startDate) : undefined,
        assignedGroup,
        clubAddress: 'Tennisstraße 123, 12345 Tennisstadt',
        clubPhone: '+49 123 456 7890',
        clubEmail: 'info@swingz.app',
      });
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail the conversion if email fails
    }

    return NextResponse.json({ 
      success: true, 
      trialTraining: updated,
      message: 'Trial training converted to member successfully'
    });
  } catch (error) {
    console.error('Trial training conversion error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
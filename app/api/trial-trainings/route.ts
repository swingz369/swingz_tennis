import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { TrialTrainingService } from '@/src/application/services/trial-training.service';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { z } from 'zod';

const createTrialTrainingSchema = z.object({
  participant: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(5),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    age: z.number().int().positive().optional(),
  }),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/),
  duration: z.number().positive(),
  trainerId: z.string().min(1),
  courtId: z.string().min(1),
  notes: z.string().optional(),
});

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Trainers and admins can create trial trainings
    const hasRole = await verifyRole(auth, 'trainer');
    if (!hasRole) {
      return forbiddenResponse('Trainer or admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await _request.json();

      const validation = createTrialTrainingSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.issues },
          { status: 400 }
        );
      }

      const trialTraining = await TrialTrainingService.createTrialTraining({
        ...validation.data,
        participant: {
          ...validation.data.participant,
          age: validation.data.participant.age ?? undefined,
        } as {
          firstName: string;
          lastName: string;
          email: string;
          phone: string;
          dateOfBirth: string;
          age?: number;
        },
      } as import('@/src/domain/entities/trial-training.entity').CreateTrialTrainingInput);

      return NextResponse.json({ success: true, trialTraining });
    } catch (error) {
      console.error('Trial training creation error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Members can view trial trainings
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) {
      return forbiddenResponse('Authentication required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { searchParams } = new URL(_request.url);
      const status = searchParams.get('status');
      const email = searchParams.get('email');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      if (email) {
        const trialTrainings =
          await TrialTrainingService.getTrialTrainingsByParticipantEmail(email);
        return NextResponse.json({ trialTrainings });
      }

      if (status) {
        const trialTrainings = await TrialTrainingService.getTrialTrainingsByStatus(
          status as 'scheduled' | 'completed' | 'cancelled' | 'no_show' | 'converted'
        );
        return NextResponse.json({ trialTrainings });
      }

      // Date range filtering removed - not yet implemented in service
      const allTrainings = await TrialTrainingService.getAllTrialTrainings();

      // Filter by date range client-side if provided
      let filteredTrainings = allTrainings;
      if (startDate && endDate) {
        filteredTrainings = allTrainings.filter((t) => {
          return t.scheduledDate >= startDate && t.scheduledDate <= endDate;
        });
      }

      return NextResponse.json({ trialTrainings: filteredTrainings });
    } catch (error) {
      console.error('Trial trainings fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

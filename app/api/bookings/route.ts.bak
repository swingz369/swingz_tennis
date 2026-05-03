import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';
import {
  CreateBookingUseCase,
  GetMemberBookingsUseCase,
} from '@/application/use-cases/booking.use-cases';
import { DrizzleBookingRepository } from '@/infrastructure/persistence/repositories/booking.repository';
import { DrizzleScheduleRepository } from '@/infrastructure/persistence/repositories/schedule.repository';
import { DrizzleTrainerRepository } from '@/infrastructure/persistence/repositories/trainer.repository';
import { createBookingSchema } from '@/application/validation/schemas';
import { withValidation } from '@/application/validation/validator';
import { SessionId, TrainerId } from '@/domain/value-objects';

const bookingRepo = new DrizzleBookingRepository();
const scheduleRepo = new DrizzleScheduleRepository();
const trainerRepo = new DrizzleTrainerRepository();

const createBookingUseCase = new CreateBookingUseCase(bookingRepo, scheduleRepo);
const getMemberBookingsUseCase = new GetMemberBookingsUseCase(bookingRepo);

// Helper: Check for demo mode cookie
function isDemoMode(req: NextRequest): boolean {
  const cookies = req.cookies.get('demo-mode');
  return !!cookies?.value;
}

// Mock bookings for demo
const DEMO_BOOKINGS = [
  {
    id: 'demo-booking-1',
    sessionId: 'demo-session-1',
    memberId: 'demo-member',
    bookedAt: new Date().toISOString(),
  },
];

// POST /api/bookings – Booking erstellen
export async function POST(req: NextRequest) {
  // Demo mode: simulate successful booking
  if (isDemoMode(req)) {
    const body = await req.json();
    return NextResponse.json(
      {
        bookingId: 'demo-booking-' + Date.now(),
        sessionId: body.sessionId,
        memberId: body.memberId,
      },
      { status: 201 }
    );
  }

  return withValidation(createBookingSchema, async (input) => {
    // Auth check
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const result = await createBookingUseCase.execute({
        memberId: input.memberId,
        sessionId: input.sessionId,
        actorId: user.id,
      });
      return NextResponse.json(result, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error creating booking:', error);
      return NextResponse.json({ error: message }, { status: 400 });
    }
  })(req);
}

// GET /api/bookings?memberId=xxx – Buchungen eines Members (mit Session-Details)
export async function GET(req: NextRequest) {
  // Demo mode: return mock bookings
  if (isDemoMode(req)) {
    return NextResponse.json(DEMO_BOOKINGS);
  }

  try {
    const url = new URL(req.url);
    const memberId = url.searchParams.get('memberId');
    if (!memberId) {
      return NextResponse.json({ error: 'memberId query parameter required' }, { status: 400 });
    }

    // Basic validation
    if (memberId.length > 100) {
      return NextResponse.json({ error: 'Member ID too long' }, { status: 400 });
    }

    // Fetch bookings (just booking info)
    const result = await getMemberBookingsUseCase.execute({ memberId });
    const bookings = result.bookings;

    // Enrich with session and trainer details
    const enriched = await Promise.all(
      bookings.map(async (b) => {
        const sessionId = SessionId.fromString(b.sessionId);
        const sessionDetails = await scheduleRepo.getSessionDetails(sessionId);

        let trainerName: string | undefined;
        if (sessionDetails?.trainerId) {
          const trainer = await trainerRepo.findById(
            TrainerId.fromString(sessionDetails.trainerId.getValue())
          );
          trainerName = trainer?.name;
        }

        return {
          id: b.id,
          sessionId: b.sessionId,
          status: b.status,
          bookedAt: b.bookedAt,
          session_start: sessionDetails?.timeslot.getStart(),
          session_end: sessionDetails?.timeslot.getEnd(),
          trainer_name: trainerName,
          clubId: sessionDetails?.clubId.getValue(),
        };
      })
    );

    return NextResponse.json(enriched);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching bookings:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

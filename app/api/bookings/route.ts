import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';
import {
  CreateBookingUseCase,
  GetMemberBookingsUseCase,
} from '@/application/use-cases/booking.use-cases';
import { DrizzleBookingRepository } from '@/infrastructure/persistence/repositories/booking.repository';
import { DrizzleScheduleRepository } from '@/infrastructure/persistence/repositories/schedule.repository';
import { createBookingSchema } from '@/application/validation/schemas';
import { withValidation } from '@/application/validation/validator';

const bookingRepo = new DrizzleBookingRepository();
const scheduleRepo = new DrizzleScheduleRepository();

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

// GET /api/bookings?memberId=xxx – Buchungen eines Members
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

    const result = await getMemberBookingsUseCase.execute({ memberId });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching bookings:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

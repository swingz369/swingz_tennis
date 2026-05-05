import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  CreateBookingUseCase,
  GetMemberBookingsUseCase,
} from '@/application/use-cases/booking.use-cases';
import { DrizzleBookingRepository } from '@/infrastructure/persistence/repositories/booking.repository';
import { DrizzleScheduleRepository } from '@/infrastructure/persistence/repositories/schedule.repository';
import { DrizzleTrainerRepository } from '@/infrastructure/persistence/repositories/trainer.repository';
import { EmailService } from '@/infrastructure/email/email.service';
import { AuditServiceImpl } from '@/infrastructure/audit/audit.service';
import { createBookingSchema } from '@/application/validation/schemas';
import { withValidation } from '@/application/validation/validator';
import { SessionId, TrainerId } from '@/domain/value-objects';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';

const bookingRepo = new DrizzleBookingRepository();
const scheduleRepo = new DrizzleScheduleRepository();
const trainerRepo = new DrizzleTrainerRepository();
const emailService = new EmailService();
const auditService = new AuditServiceImpl();

const createBookingUseCase = new CreateBookingUseCase(
  bookingRepo,
  scheduleRepo,
  emailService,
  auditService
);
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

  return withApiAuth(req, async (auth) => {
    // Members can create bookings
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Authentication required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) {
      return rateLimitError;
    }

    return withValidation(createBookingSchema, async (input) => {
      try {
        const result = await createBookingUseCase.execute({
          memberId: input.memberId,
          sessionId: input.sessionId,
          actorId: auth.user.id,
        });
        return NextResponse.json(result, { status: 201 });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error creating booking:', error);
        return NextResponse.json({ error: message }, { status: 400 });
      }
    })(req);
  });
}

// GET /api/bookings?memberId=xxx – Buchungen eines Members (mit Session-Details)
export async function GET(req: NextRequest) {
  // Demo mode: return mock bookings
  if (isDemoMode(req)) {
    return NextResponse.json(DEMO_BOOKINGS);
  }

  return withApiAuth(req, async (auth) => {
    // Members can view bookings
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Authentication required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) {
      return rateLimitError;
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

      // ✅ Batch-Loading: Collect all session IDs and fetch in one query
      const sessionIds = bookings.map((b) => SessionId.fromString(b.sessionId));

      // ✅ Fetch all session details in ONE batch query using the new method
      const sessionDetailsMap = await scheduleRepo.getSessionDetailsByIds(sessionIds);

      // ✅ Collect unique trainer IDs from session details
      const trainerIds = new Set<string>();
      for (const [, details] of sessionDetailsMap) {
        if (details?.trainerId) {
          trainerIds.add(details.trainerId);
        }
      }

      // ✅ Fetch all trainers in ONE batch query using findByIds
      const trainersMap = new Map<string, string>();
      if (trainerIds.size > 0) {
        const trainerIdObjects = Array.from(trainerIds).map((id) => TrainerId.fromString(id));
        const trainers = await trainerRepo.findByIds(trainerIdObjects);
        trainers.forEach((trainer) => {
          trainersMap.set(trainer.trainerId.getValue(), trainer.name);
        });
      }

      // ✅ In-memory join (no additional queries)
      const enriched = bookings.map((b) => {
        const sessionDetails = sessionDetailsMap.get(b.sessionId);
        const trainerName = sessionDetails?.trainerId
          ? trainersMap.get(sessionDetails.trainerId)
          : undefined;

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
      });

      return NextResponse.json(enriched);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error fetching bookings:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { DrizzleScheduleRepository } from '@/infrastructure/persistence/repositories/schedule.repository';
import { DrizzleTrainerRepository } from '@/infrastructure/persistence/repositories/trainer.repository';
import { createClient } from '@/infrastructure/external/supabase/server';
import type { BookingStatus } from '@/domain/entities/booking';
import { ClubId, TrainerId } from '@/domain/value-objects';
import { cookies } from 'next/headers';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';

const scheduleRepo = new DrizzleScheduleRepository();
const trainerRepo = new DrizzleTrainerRepository();

// Helper: Check for demo mode cookie
async function isDemoMode(): Promise<boolean> {
  const cookieStore = await cookies();
  const hasDemoMode = cookieStore.get('demo-mode');
  return !!hasDemoMode?.value;
}

// Mock sessions for demo mode with trainer names
const DEMO_SESSIONS = [
  {
    id: 'demo-session-1',
    week: '2025-W01',
    dayOfWeek: 1,
    startTime: '10:00',
    endTime: '11:00',
    trainerId: 'demo-trainer',
    trainerName: 'Max Mustermann',
    groupIds: ['demo-group-1'],
    maxParticipants: 4,
    notes: 'Demo training session',
    clubId: 'demo-club',
    scheduleId: 'demo-schedule',
  },
  {
    id: 'demo-session-2',
    week: '2025-W01',
    dayOfWeek: 3,
    startTime: '14:00',
    endTime: '15:30',
    trainerId: 'demo-trainer-2',
    trainerName: 'Anna Schmidt',
    groupIds: ['demo-group-2'],
    maxParticipants: 6,
    notes: 'Advanced training',
    clubId: 'demo-club',
    scheduleId: 'demo-schedule',
  },
  {
    id: 'demo-session-3',
    week: '2025-W01',
    dayOfWeek: 5,
    startTime: '16:00',
    endTime: '17:00',
    trainerId: 'demo-trainer',
    trainerName: 'Max Mustermann',
    groupIds: ['demo-group-1', 'demo-group-2'],
    maxParticipants: 8,
    notes: 'Mixed group',
    clubId: 'demo-club',
    scheduleId: 'demo-schedule',
  },
];

// GET /api/sessions?clubId=xxx – Sessions für einen Club (buchbar)
export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    // Members can view sessions
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Authentication required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) {
      return rateLimitError;
    }

    const url = new URL(req.url);
    const clubIdParam = url.searchParams.get('clubId');

    // Validate clubId is present
    if (!clubIdParam) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
    }

    // Demo mode: return mock sessions with trainer names (skip validation)
    if (await isDemoMode()) {
      return NextResponse.json(DEMO_SESSIONS);
    }

    // Optional: validate clubId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(clubIdParam)) {
      return NextResponse.json({ error: 'Invalid club ID format' }, { status: 400 });
    }

    try {
      const clubId = ClubId.fromString(clubIdParam);
      const schedule = await scheduleRepo.findByClubId(clubId);
      if (!schedule) {
        return NextResponse.json([]);
      }

      const sessions = schedule.getSessions();

      // Collect all unique trainer IDs
      const trainerIds = Array.from(new Set(sessions.map((s) => s.trainerId.toString())));

      // Fetch trainers in batch
      const trainersMap = new Map<string, string>();
      if (trainerIds.length > 0) {
        const trainers = await Promise.all(
          trainerIds.map((id) => trainerRepo.findById(TrainerId.fromString(id)))
        );
        trainers.forEach((trainer, idx) => {
          if (trainer) {
            trainersMap.set(trainerIds[idx], trainer.name);
          }
        });
      }

      // Fetch current user's bookings for this club (if authenticated)
      const userBookingsMap = new Map<string, { bookingId: string; status: BookingStatus }>();
      if (!(await isDemoMode())) {
        try {
          const supabaseClient = await createClient();
          const {
            data: { user },
          } = await supabaseClient.auth.getUser();
          if (user) {
            const { data: bookings } = await supabaseClient
              .from('bookings')
              .select('id, session_id, status')
              .eq('member_id', user.id)
              .eq('club_id', clubId.getValue());
            if (bookings) {
              for (const b of bookings) {
                userBookingsMap.set(b.session_id, {
                  bookingId: b.id,
                  status: b.status as BookingStatus,
                });
              }
            }
          }
        } catch (e) {
          console.error('Failed to fetch user bookings:', e);
        }
      }

      const sessionsList = sessions.map((s) => {
        const ub = userBookingsMap.get(s.id);
        return {
          id: s.id,
          week: s.week.toString(),
          dayOfWeek: s.timeslot.getStart().getDay(),
          startTime: s.timeslot.getStart().toISOString().substring(11, 16),
          endTime: s.timeslot.getEnd().toISOString().substring(11, 16),
          trainerId: s.trainerId.toString(),
          trainerName: trainersMap.get(s.trainerId.toString()) || s.trainerId.toString(),
          groupIds: s.groupIds,
          maxParticipants: s.maxParticipants,
          notes: s.notes,
          clubId: schedule.getClubId().getValue(),
          scheduleId: schedule.getId().getValue(),
          bookedByUser: !!ub,
          bookingId: ub?.bookingId,
          bookingStatus: ub?.status,
        };
      });

      return NextResponse.json(sessionsList);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error fetching sessions:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

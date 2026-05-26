import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { OptimizeScheduleUseCase } from '@/application/use-cases/schedule.use-cases';
import { SchedulingService } from '@/domain/services/scheduling.service';
import { DrizzleScheduleRepository } from '@/infrastructure/persistence/repositories/schedule.repository';
import { DrizzleTrainerRepository } from '@/infrastructure/persistence/repositories/trainer.repository';
import { ClubId } from '@/domain/value-objects';
import { optimizeScheduleSchema, updateSessionsSchema } from '@/application/validation/schemas';
import { withValidation } from '@/application/validation/validator';
import { db } from '@/src/infrastructure/persistence/db';
import { eq } from 'drizzle-orm';
import { sessions } from '@/infrastructure/persistence/schema';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { cache } from '@/lib/utils/cache';

const scheduleRepo = new DrizzleScheduleRepository();
const trainerRepo = new DrizzleTrainerRepository();
const schedulingService = new SchedulingService(trainerRepo);
const optimizeScheduleUseCase = new OptimizeScheduleUseCase(scheduleRepo, schedulingService);

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'member');
    if (!hasRole) {
      return forbiddenResponse('Member access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const clubIdParam = new URL(req.url).searchParams.get('clubId');
    if (!clubIdParam) return NextResponse.json({ error: 'clubId required' }, { status: 400 });

    try {
      const clubId = ClubId.fromString(clubIdParam);
      const schedule = await scheduleRepo.findByClubId(clubId);
      if (!schedule) return NextResponse.json({ error: 'No schedule found' }, { status: 404 });

      const sessionsList = schedule.getSessions().map((s) => {
        const startDay = s.timeslot.getStart().getDay();
        const dayOfWeek = startDay === 0 ? 7 : startDay;
        return {
          id: s.id,
          dayOfWeek,
          startTime: s.timeslot.getStart().toISOString().substring(11, 16),
          endTime: s.timeslot.getEnd().toISOString().substring(11, 16),
          trainerId: s.trainerId.toString(),
          groupIds: s.groupIds,
          maxParticipants: s.maxParticipants,
          notes: s.notes,
        };
      });

      return NextResponse.json({
        scheduleId: schedule.getId().getValue(),
        clubId: schedule.getClubId().getValue(),
        sessions: sessionsList,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    return withValidation(optimizeScheduleSchema, async (input) => {
      try {
        const output = await optimizeScheduleUseCase.execute({
          clubId: input.clubId,
          seasonType: input.seasonType,
          year: input.year,
          forceRegenerate: input.forceRegenerate ?? false,
        });
        const schedule = output.schedule;
        const sessionsList = schedule.getSessions().map((s) => {
          const startDay = s.timeslot.getStart().getDay();
          const dayOfWeek = startDay === 0 ? 7 : startDay;
          return {
            id: s.id,
            dayOfWeek,
            startTime: s.timeslot.getStart().toISOString().substring(11, 16),
            endTime: s.timeslot.getEnd().toISOString().substring(11, 16),
            trainerId: s.trainerId.toString(),
            groupIds: s.groupIds,
            maxParticipants: s.maxParticipants,
            notes: s.notes,
          };
        });

        return NextResponse.json({
          success: true,
          scheduleId: schedule.getId().getValue(),
          sessions: sessionsList,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
      }
    })(req);
  });
}

export async function PUT(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    return withValidation(updateSessionsSchema, async (input) => {
      try {
        // Use a transaction to batch all updates together for better performance
        await db.transaction(async (tx) => {
          // Process updates in batches of 50 to avoid too many queries
          const BATCH_SIZE = 50;
          for (let i = 0; i < input.sessions.length; i += BATCH_SIZE) {
            const batch = input.sessions.slice(i, i + BATCH_SIZE);

            // Execute all updates in this batch in parallel within the transaction
            await Promise.all(
              batch.map((sessionData) => {
                if (sessionData.id) {
                  return tx
                    .update(sessions)
                    .set({
                      trainer_id: sessionData.trainerId,
                      court_id: sessionData.courtId ?? null,
                      week_number: sessionData.weekNumber,
                      timeslot_start: new Date(sessionData.timeslotStart),
                      timeslot_end: new Date(sessionData.timeslotEnd),
                      max_participants: sessionData.maxParticipants,
                      notes: sessionData.notes ?? null,
                      group_ids: sessionData.groupIds,
                      updated_at: new Date(),
                    })
                    .where(eq(sessions.id, sessionData.id));
                }
                return Promise.resolve();
              })
            );
          }
        });

        // Invalidate all schedule and session caches after bulk update
        cache.invalidatePattern('schedule:');
        cache.invalidatePattern('session:');

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
      }
    })(req);
  });
}

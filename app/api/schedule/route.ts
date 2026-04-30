import { NextRequest, NextResponse } from 'next/server';
import { OptimizeScheduleUseCase } from '@/application/use-cases/schedule.use-cases';
import { SchedulingService } from '@/domain/services/scheduling.service';
import { DrizzleScheduleRepository } from '@/infrastructure/persistence/repositories/schedule.repository';
import { DrizzleTrainerRepository } from '@/infrastructure/persistence/repositories/trainer.repository';
import { ClubId } from '@/domain/value-objects';
import { optimizeScheduleSchema, updateSessionsSchema } from '@/application/validation/schemas';
import { withValidation } from '@/application/validation/validator';

const scheduleRepo = new DrizzleScheduleRepository();
const trainerRepo = new DrizzleTrainerRepository();
const schedulingService = new SchedulingService(trainerRepo);
const optimizeScheduleUseCase = new OptimizeScheduleUseCase(scheduleRepo, schedulingService);

function isDemoMode(req: NextRequest): boolean {
  const cookies = req.cookies.get('demo-mode');
  return !!cookies?.value;
}

const DEMO_SCHEDULE = {
  scheduleId: 'demo-schedule-1',
  clubId: 'demo-club',
  sessions: [
    {
      id: 'sess-1',
      dayOfWeek: 1,
      startTime: '10:00',
      endTime: '11:00',
      trainerId: 'trainer-1',
      trainerName: 'Max Mustermann',
      groupIds: ['group-1'],
      groupNames: ['Anfänger'],
      maxParticipants: 4,
      notes: 'Einsteiger',
    },
    {
      id: 'sess-2',
      dayOfWeek: 3,
      startTime: '14:00',
      endTime: '15:30',
      trainerId: 'trainer-2',
      trainerName: 'Anna Schmidt',
      groupIds: ['group-2'],
      groupNames: ['Fortgeschrittene'],
      maxParticipants: 6,
      notes: 'intensiv',
    },
    {
      id: 'sess-3',
      dayOfWeek: 5,
      startTime: '16:00',
      endTime: '17:00',
      trainerId: 'trainer-1',
      trainerName: 'Max Mustermann',
      groupIds: ['group-1', 'group-2'],
      groupNames: ['Anfänger', 'Fortgeschrittene'],
      maxParticipants: 8,
      notes: 'Mixed',
    },
  ],
};

export async function GET(req: NextRequest) {
  const clubIdParam = new URL(req.url).searchParams.get('clubId');
  if (!clubIdParam) return NextResponse.json({ error: 'clubId required' }, { status: 400 });

  if (isDemoMode(req)) return NextResponse.json(DEMO_SCHEDULE);

  try {
    const clubId = ClubId.fromString(clubIdParam);
    const schedule = await scheduleRepo.findByClubId(clubId);
    if (!schedule) return NextResponse.json({ error: 'No schedule found' }, { status: 404 });

    const sessions = schedule.getSessions().map((s) => {
      const startDay = s.timeslot.getStart().getDay();
      const dayOfWeek = startDay === 0 ? 7 : startDay; // convert Sun=0 -> 7
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
      sessions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return withValidation(optimizeScheduleSchema, async (input) => {
    try {
      if (isDemoMode(req)) {
        await new Promise((r) => setTimeout(r, 1500));
        return NextResponse.json({
          success: true,
          message: 'Optimized (demo)',
          schedule: DEMO_SCHEDULE,
        });
      }

      const output = await optimizeScheduleUseCase.execute({
        clubId: input.clubId,
        seasonType: input.seasonType,
        year: input.year,
        forceRegenerate: input.forceRegenerate ?? false,
      });
      const schedule = output.schedule;
      const sessions = schedule.getSessions().map((s) => {
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
        sessions,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  })(req);
}

export async function PUT(req: NextRequest) {
  return withValidation(updateSessionsSchema, async (_input) => {
    void _input; // silence unused warning
    try {
      if (isDemoMode(req)) {
        return NextResponse.json({ success: true, message: 'Updated (demo)' });
      }

      // TODO: Persist changes using repository
      // For now, just validate and return success
      return NextResponse.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  })(req);
}

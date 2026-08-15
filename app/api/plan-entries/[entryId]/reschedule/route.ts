// POST /api/plan-entries/[entryId]/reschedule
//
// Verschiebt eine bereits veröffentlichte Trainingsgruppe auf einen neuen
// Wochentag/Zeit/Trainer/Platz — ab einem wählbaren Datum (Standard: jetzt).
// Ändert sowohl alle künftigen `sessions`-Zeilen (das, was Trainer/Mitglieder
// im Wochenplan sehen) als auch die Saisonplan-Vorlage selbst.
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { db } from '@/src/infrastructure/persistence/db';
import { seasonPlanEntries, sessions } from '@/src/infrastructure/persistence/schema';
import { and, eq, gte, notInArray, sql } from 'drizzle-orm';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:plan-entries:[entryId]:reschedule');

interface RouteContext {
  params: Promise<{ entryId: string }>;
}

interface RescheduleBody {
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  trainer_id?: string;
  court_id?: string | null;
  effective_from?: string; // ISO date; default: jetzt
}

const WEEKDAY_LABELS = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
];

function parseHHMM(value: string): { h: number; m: number } {
  const [h, m] = value.split(':');
  return { h: parseInt(h, 10), m: parseInt(m, 10) };
}

function isoMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0=So..6=Sa
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

// dayOfWeek-Konvention (wie im Rest der Saisonplanung): 0=Montag ... 6=Sonntag
function shiftToWeekday(monday: Date, dayOfWeek: number, hh: number, mm: number): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + dayOfWeek);
  d.setHours(hh, mm, 0, 0);
  return d;
}

export async function POST(request: NextRequest, context: RouteContext) {
  return withCSRFProtection(request, async () => {
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      const { entryId } = await context.params;
      try {
        const isAdmin = await verifyRole(auth, 'admin');
        const isSuperadmin = await verifyRole(auth, 'superadmin');
        if (!isAdmin && !isSuperadmin) {
          return forbiddenResponse('Nur Admins können Trainingszeiten verschieben');
        }

        const [entry] = await db
          .select()
          .from(seasonPlanEntries)
          .where(eq(seasonPlanEntries.id, entryId));
        if (!entry) {
          return NextResponse.json({ error: 'Plan-Eintrag nicht gefunden' }, { status: 404 });
        }

        if (!isSuperadmin) {
          const hasClubAccess = auth.memberships.some(
            (m) => m.club_id === entry.club_id && (m.role === 'admin' || m.role === 'superadmin')
          );
          if (!hasClubAccess) return forbiddenResponse('Kein Zugriff auf diese Saison');
        }

        const body: RescheduleBody = await request.json();

        const finalDayOfWeek = body.day_of_week ?? entry.day_of_week;
        const finalStartTime = body.start_time ?? entry.start_time;
        const finalEndTime = body.end_time ?? entry.end_time;
        const finalTrainerId = body.trainer_id ?? entry.trainer_id;
        const finalCourtId = body.court_id !== undefined ? body.court_id : entry.court_id;

        if (finalDayOfWeek < 0 || finalDayOfWeek > 6) {
          return NextResponse.json(
            { error: 'day_of_week must be between 0 and 6' },
            { status: 400 }
          );
        }
        if (finalStartTime >= finalEndTime) {
          return NextResponse.json(
            { error: 'start_time must be before end_time' },
            { status: 400 }
          );
        }
        // Vereinsrealität: regulärer Trainingsbetrieb findet nicht sonntags statt.
        if (finalDayOfWeek === 6 && entry.entry_type === 'training') {
          return NextResponse.json(
            { error: 'Trainingsstunden können nicht auf einen Sonntag gelegt werden (nur Mo-Sa).' },
            { status: 400 }
          );
        }

        const effectiveFrom = body.effective_from ? new Date(body.effective_from) : new Date();
        if (Number.isNaN(effectiveFrom.getTime())) {
          return NextResponse.json(
            { error: 'effective_from ist kein gültiges Datum' },
            { status: 400 }
          );
        }

        const affectedSessions = await db
          .select()
          .from(sessions)
          .where(
            and(eq(sessions.plan_entry_id, entryId), gte(sessions.timeslot_start, effectiveFrom))
          );

        if (affectedSessions.length === 0) {
          return NextResponse.json(
            {
              error:
                'Keine künftigen Trainingseinheiten ab diesem Datum gefunden — ist die Saison veröffentlicht?',
            },
            { status: 400 }
          );
        }

        const { h: startH, m: startM } = parseHHMM(finalStartTime);
        const { h: endH, m: endM } = parseHHMM(finalEndTime);
        const durationMs = (endH * 60 + endM - (startH * 60 + startM)) * 60 * 1000;

        const scheduleId = affectedSessions[0].schedule_id;
        const movingIds = affectedSessions.map((s) => s.id);

        const moves = affectedSessions.map((s) => {
          const monday = isoMonday(s.timeslot_start);
          const newStart = shiftToWeekday(monday, finalDayOfWeek, startH, startM);
          const newEnd = new Date(newStart.getTime() + durationMs);
          return { sessionId: s.id, newStart, newEnd };
        });

        // Konfliktprüfung: für jeden neuen Termin darf kein anderer Trainings-/Buchungstermin
        // desselben Trainers oder Platzes in diesem Club kollidieren.
        const conflictDates: string[] = [];
        for (const move of moves) {
          const conflicts = await db
            .select({ id: sessions.id })
            .from(sessions)
            .where(
              and(
                eq(sessions.schedule_id, scheduleId),
                notInArray(sessions.id, movingIds),
                sql`(${sessions.timeslot_start} < ${move.newEnd} AND ${sessions.timeslot_end} > ${move.newStart})`,
                sql`(
                  ${sessions.trainer_id} = ${finalTrainerId}
                  ${finalCourtId ? sql`OR ${sessions.court_id} = ${finalCourtId}` : sql``}
                )`
              )
            );
          if (conflicts.length > 0) {
            conflictDates.push(move.newStart.toLocaleDateString('de-DE'));
          }
        }

        if (conflictDates.length > 0) {
          return NextResponse.json(
            {
              error: 'Terminkonflikt erkannt',
              details: `Trainer oder Platz ist an folgenden Tagen bereits belegt: ${conflictDates.join(', ')}`,
            },
            { status: 409 }
          );
        }

        const auditLine = `Verschoben ab ${effectiveFrom.toLocaleDateString('de-DE')} auf ${WEEKDAY_LABELS[finalDayOfWeek]} ${finalStartTime.substring(0, 5)}–${finalEndTime.substring(0, 5)}`;

        await db.transaction(async (tx) => {
          for (const move of moves) {
            await tx
              .update(sessions)
              .set({
                timeslot_start: move.newStart,
                timeslot_end: move.newEnd,
                trainer_id: finalTrainerId,
                court_id: finalCourtId,
                updated_at: new Date(),
              })
              .where(eq(sessions.id, move.sessionId));
          }

          await tx
            .update(seasonPlanEntries)
            .set({
              day_of_week: finalDayOfWeek,
              start_time: finalStartTime,
              end_time: finalEndTime,
              trainer_id: finalTrainerId,
              court_id: finalCourtId,
              admin_notes: entry.admin_notes ? `${entry.admin_notes}\n${auditLine}` : auditLine,
            })
            .where(eq(seasonPlanEntries.id, entryId));
        });

        return NextResponse.json({
          success: true,
          movedSessions: moves.length,
          message: `${moves.length} Trainingseinheit${moves.length !== 1 ? 'en' : ''} verschoben`,
        });
      } catch (error) {
        log.error(`POST /api/plan-entries/${entryId}/reschedule error:`, error);
        return internalErrorResponse();
      }
    });
  });
}

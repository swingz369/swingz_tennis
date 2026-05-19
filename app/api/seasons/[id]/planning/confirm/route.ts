// POST /api/seasons/[id]/planning/confirm
// Schritt 6: Final confirmation and plan publishing

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { getDb } from '@/src/infrastructure/persistence/client';
import { seasons, seasonPlanEntries, sessions } from '@/src/infrastructure/persistence/schema';
import { markHolidaySessions } from '@/lib/services/school-holidays.service';
// seasonWaitlists not needed in confirm route — waitlist data is in plan entries
import { eq } from 'drizzle-orm';
import { ConflictDetector } from '@/lib/season-planning/conflict-detector';
import type { ConfirmPlanRequest, ConfirmPlanResponse, GroupAssignment } from '@/lib/season-planning/types';

interface RouteContext { params: Promise<{ id: string }>; }

export async function POST(request: NextRequest, context: RouteContext) {
  return withCSRFProtection(request, async () => {
    const rateLimitError = await checkRateLimitOrFail(request, { max: 3, windowMs: 3600000 });
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      try {
        const { id: seasonId } = await context.params;
        const [season] = await getDb().select().from(seasons).where(eq(seasons.id, seasonId));
        if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

        const isAdmin = await verifyRole(auth, 'admin');
        const isSuperadmin = await verifyRole(auth, 'superadmin');
        if (!isAdmin && !isSuperadmin) return forbiddenResponse('Nur Admins');
        if (!isSuperadmin && season.club_id !== auth.clubId) return forbiddenResponse('Kein Zugriff');

        const body: ConfirmPlanRequest = await request.json();

        // Re-run conflict detection
        const detector = new ConflictDetector(seasonId, season.club_id);
        const entries = await getDb().select().from(seasonPlanEntries).where(eq(seasonPlanEntries.season_id, seasonId));

        // Build GroupAssignments from plan entries
        const assignments: GroupAssignment[] = [];
        const groupMap = new Map<string, GroupAssignment>();
        for (const entry of entries) {
          const gid = entry.group_id || entry.id;
          if (groupMap.has(gid)) {
            const ga = groupMap.get(gid)!;
            ga.memberIds.push(...((entry.expected_participants as string[]) || []));
            ga.memberDetails.push(...((entry.expected_participants as string[]) || []).map((mid) => ({
              memberId: mid,
              memberName: mid,
              niveauMatch: 100,
              experienceMonths: 0,
              groupExperienceSpan: '0-0 Monate',
              wishPartnerFulfilled: false,
              wishPartnerNames: [],
              isPromoted: false,
              assignmentReason: '',
            })));
          } else {
            const ga: GroupAssignment = {
              groupId: gid,
              groupName: entry.group_id || entry.id,
              trainerId: entry.trainer_id,
              trainerName: entry.trainer_id,
              dayOfWeek: entry.day_of_week as any,
              startTime: entry.start_time?.substring(0, 5) || '00:00',
              endTime: entry.end_time?.substring(0, 5) || '00:00',
              courtId: entry.court_id,
              courtName: entry.court_id,
              memberIds: (entry.expected_participants as string[]) || [],
              memberDetails: ((entry.expected_participants as string[]) || []).map((mid) => ({
                memberId: mid,
                memberName: mid,
                niveauMatch: 100,
                experienceMonths: 0,
                groupExperienceSpan: '0-0 Monate',
                wishPartnerFulfilled: false,
                wishPartnerNames: [],
                isPromoted: false,
                assignmentReason: '',
              })),
              waitlistIds: [],
              waitlistDetails: [],
              warnings: [],
              conflictIds: [],
            };
            groupMap.set(gid, ga);
            assignments.push(ga);
          }
        }

        const conflicts = await detector.detectAll(assignments);
        const criticalConflicts = detector.getCriticalConflicts(conflicts);
        const unresolvedCritical = criticalConflicts.filter((c) => !body.acceptedWarnings.includes(c.id));

        if (unresolvedCritical.length > 0) {
          return NextResponse.json(
            {
              success: false,
              error: 'Kritische Konflikte müssen behoben werden',
              unresolvedCriticalConflicts: unresolvedCritical.map((c) => ({
                id: c.id,
                type: c.type,
                description: c.description,
              })),
            },
            { status: 409 }
          );
        }

        // Publish: Create actual sessions from plan entries
        const db = getDb();
        let publishedCount = 0;
        const publishedIds: string[] = [];

        for (const entry of entries) {
          if (entry.status === 'published') continue;

          // Create a recurring session template
          const [session] = await db
            .insert(sessions)
            .values({
              schedule_id: '', // Will need to link to schedule
              trainer_id: entry.trainer_id,
              group_ids: entry.group_id ? [entry.group_id] : [],
              week_number: 1,
              timeslot_start: new Date(season.start_date),
              timeslot_end: new Date(season.start_date),
              court_id: entry.court_id,
              max_participants: entry.max_participants,
              notes: 'Erstellt durch Saisonplanung',
            })
            .returning();

          await db
            .update(seasonPlanEntries)
            .set({
              status: 'published',
              published_session_id: session.id,
              published_at: new Date(),
            })
            .where(eq(seasonPlanEntries.id, entry.id));

          publishedIds.push(session.id);
          publishedCount++;
        }

        // TODO: Log to season planning audit history when table is available
        // await db.insert(seasonPlanningHistory).values({...});

        // Mark sessions that fall on school holidays as holiday_cancelled
        const scheduleIds = [...new Set(
          entries.map((e) => (e as any).schedule_id as string).filter(Boolean)
        )];
        for (const scheduleId of scheduleIds) {
          const markedCount = await markHolidaySessions(auth.supabase, scheduleId, season.club_id);
          if (markedCount > 0) {
            console.log(`[Season] Marked ${markedCount} sessions as holiday_cancelled`);
          }
        }

        // Update season status
        await db
          .update(seasons)
          .set({ planning_status: 'published', published_at: new Date() })
          .where(eq(seasons.id, seasonId));

        const response: ConfirmPlanResponse = {
          success: true,
          publishedSessions: publishedCount,
          notificationsSent: 0, // Notification system TBD
          waitlistNotifications: 0,
          unresolvedCriticalConflicts: [],
        };

        return NextResponse.json(response);
      } catch (error) {
        console.error('POST confirm error:', error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Confirmation failed' },
          { status: 500 }
        );
      }
    });
  });
}

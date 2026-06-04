// POST /api/seasons/[id]/planning/confirm
// Schritt 6: Final confirmation and plan publishing

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { db } from '@/src/infrastructure/persistence/db';
import {
  seasons,
  seasonPlanEntries,
  sessions,
  schedules,
  seasonPlanningHistory,
  users,
} from '@/src/infrastructure/persistence/schema';
import { markHolidaySessions } from '@/lib/services/school-holidays.service';
import { eq, and, inArray } from 'drizzle-orm';
import { ConflictDetector } from '@/lib/season-planning/conflict-detector';
import { Resend } from 'resend';
import { env } from '@/lib/env';
import type {
  ConfirmPlanRequest,
  ConfirmPlanResponse,
  GroupAssignment,
} from '@/lib/season-planning/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  return withCSRFProtection(request, async () => {
    const rateLimitError = await checkRateLimitOrFail(request, { max: 3, windowMs: 3600000 });
    if (rateLimitError) return rateLimitError;

    return withApiAuth(request, async (auth) => {
      try {
        const { id: seasonId } = await context.params;
        const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
        if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

        const isAdmin = await verifyRole(auth, 'admin');
        const isSuperadmin = await verifyRole(auth, 'superadmin');
        if (!isAdmin && !isSuperadmin) return forbiddenResponse('Nur Admins');
        if (!isSuperadmin) {
          const hasClubAccess = auth.memberships.some(
            (m) => m.club_id === season.club_id && (m.role === 'admin' || m.role === 'superadmin')
          );
          if (!hasClubAccess) return forbiddenResponse('Kein Zugriff auf diesen Club');
        }

        const body: ConfirmPlanRequest = await request.json();

        // Re-run conflict detection
        const detector = new ConflictDetector(seasonId, season.club_id);
        const entries = await db
          .select()
          .from(seasonPlanEntries)
          .where(eq(seasonPlanEntries.season_id, seasonId));

        // Build GroupAssignments from plan entries
        const assignments: GroupAssignment[] = [];
        const groupMap = new Map<string, GroupAssignment>();
        for (const entry of entries) {
          const gid = entry.group_id || entry.id;
          if (groupMap.has(gid)) {
            const ga = groupMap.get(gid)!;
            ga.memberIds.push(...((entry.expected_participants as string[]) || []));
            ga.memberDetails.push(
              ...((entry.expected_participants as string[]) || []).map((mid) => ({
                memberId: mid,
                memberName: mid,
                niveauMatch: 100,
                experienceMonths: 0,
                groupExperienceSpan: '0-0 Monate',
                wishPartnerFulfilled: false,
                wishPartnerNames: [],
                isPromoted: false,
                assignmentReason: '',
              }))
            );
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
        const unresolvedCritical = criticalConflicts.filter(
          (c) => !body.acceptedWarnings.includes(c.id)
        );

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

        // ── Publish transaction ──────────────────────────────────────────
        // All DB writes run in a single transaction. If anything fails after
        // sessions are created (audit trail, conflict persistence, season
        // status update), the entire publish rolls back automatically.
        // ──────────────────────────────────────────────────────────────────
        const { publishedCount, publishedIds, scheduleId } = await db.transaction(async (tx) => {
          let publishedCount = 0;
          const publishedIds: string[] = [];

          // 1. Find or create a schedule for this season (only if we have entries)
          // Use season.year (integer) which is more reliable than parsing start_date
          const seasonYear =
            typeof season.year === 'number' && !Number.isNaN(season.year)
              ? season.year
              : new Date().getFullYear();
          let scheduleId: string | null = null;

          // 2. Compute season length in weeks with safe date handling
          let seasonStart = season.start_date ? new Date(season.start_date) : new Date();
          let seasonEnd = season.end_date
            ? new Date(season.end_date)
            : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

          // If dates are invalid (NaN), replace with sensible defaults
          if (isNaN(seasonStart.getTime())) {
            seasonStart = new Date();
          }
          if (isNaN(seasonEnd.getTime())) {
            seasonEnd = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
          }

          const seasonLengthDays = Math.ceil(
            (seasonEnd.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24)
          );
          const totalSeasonWeeks = Math.max(1, Math.ceil(seasonLengthDays / 7));

          // 3. Create recurring weekly sessions for each plan entry
          for (const entry of entries) {
            if (entry.status === 'published') continue;

            // Lazily find or create schedule on first entry to publish
            if (!scheduleId) {
              const [existingSchedule] = await tx
                .select()
                .from(schedules)
                .where(
                  and(eq(schedules.club_id, season.club_id), eq(schedules.season_year, seasonYear))
                )
                .limit(1);

              if (existingSchedule) {
                scheduleId = existingSchedule.id;
              } else {
                const [newSchedule] = await tx
                  .insert(schedules)
                  .values({
                    club_id: season.club_id,
                    season_type: 'summer',
                    season_year: seasonYear,
                    season_start_date: seasonStart,
                    season_end_date: seasonEnd,
                    is_active: true,
                  })
                  .returning({ id: schedules.id });
                scheduleId = newSchedule.id;
              }
            }

            // Parse times from entry (HH:MM:SS)
            const startParts = (entry.start_time || '00:00:00').split(':');
            const endParts = (entry.end_time || '00:00:00').split(':');
            const startHours = parseInt(startParts[0], 10);
            const startMinutes = parseInt(startParts[1], 10);
            const endHours = parseInt(endParts[0], 10);
            const endMinutes = parseInt(endParts[1], 10);
            const durationMs =
              (endHours * 60 + endMinutes - (startHours * 60 + startMinutes)) * 60 * 1000;
            const actualDurationMs =
              durationMs > 0 ? durationMs : entry.duration_minutes * 60 * 1000;

            // DayOfWeek convention: 0=Monday, 1=Tuesday, ..., 6=Sunday
            // JavaScript getDay(): 0=Sunday, 1=Monday, ..., 6=Saturday
            const targetDayOfWeek = entry.day_of_week;
            const jsDayOfWeek = targetDayOfWeek === 6 ? 0 : targetDayOfWeek + 1;

            // Find the first date matching target day_of_week on or after season start
            const firstDate = new Date(seasonStart);
            let daysUntil = jsDayOfWeek - firstDate.getDay();
            if (daysUntil < 0) daysUntil += 7;
            firstDate.setDate(firstDate.getDate() + daysUntil);
            firstDate.setHours(startHours, startMinutes, 0, 0);

            const startWeek = entry.starts_from_week || 1;
            const endWeek = entry.ends_at_week || totalSeasonWeeks;
            const createdSessionIds: string[] = [];

            for (let week = startWeek; week <= endWeek && week <= totalSeasonWeeks; week++) {
              const sessionDate = new Date(firstDate);
              sessionDate.setDate(sessionDate.getDate() + (week - 1) * 7);

              // Skip if session would be after season end
              if (sessionDate > seasonEnd) break;

              const sessionEndDate = new Date(sessionDate.getTime() + actualDurationMs);

              const [newSession] = await tx
                .insert(sessions)
                .values({
                  schedule_id: scheduleId,
                  trainer_id: entry.trainer_id,
                  group_ids: entry.group_id ? [entry.group_id] : [],
                  week_number: week,
                  timeslot_start: sessionDate,
                  timeslot_end: sessionEndDate,
                  court_id: entry.court_id,
                  max_participants: entry.max_participants || 10,
                  notes: 'Erstellt durch Saisonplanung',
                })
                .returning({ id: sessions.id });

              createdSessionIds.push(newSession.id);
            }

            // Update plan entry with the first session ID as reference
            if (createdSessionIds.length > 0) {
              await tx
                .update(seasonPlanEntries)
                .set({
                  status: 'published',
                  published_session_id: createdSessionIds[0],
                  published_at: new Date(),
                })
                .where(eq(seasonPlanEntries.id, entry.id));
            }

            publishedIds.push(...createdSessionIds);
            publishedCount += createdSessionIds.length;
          }

          // 4. Update season status (inside transaction)
          await tx
            .update(seasons)
            .set({ planning_status: 'published', published_at: new Date() })
            .where(eq(seasons.id, seasonId));

          // 5. Persist detected conflicts (pass tx so it participates in the transaction)
          await detector.persistConflicts(conflicts, tx);

          // 6. Write audit trail (inside transaction)
          await tx.insert(seasonPlanningHistory).values({
            season_id: seasonId,
            club_id: season.club_id,
            action_type: 'plan_published',
            actor_id: auth.user.id,
            actor_role: 'admin',
            details: {
              publishedSessions: publishedCount,
              entriesCount: entries.length,
              conflictsDetected: conflicts.length,
              criticalConflicts: criticalConflicts.length,
              acceptedWarnings: body.acceptedWarnings,
            },
            entries_affected: publishedCount,
            conflicts_created: conflicts.length,
            conflicts_resolved: 0,
            notes: `Plan veröffentlicht: ${publishedCount} Sessions aus ${entries.length} Einträgen`,
          });

          return { publishedCount, publishedIds, scheduleId };
        });

        // ── Post-transaction (non-critical) ───────────────────────────────
        // These run AFTER the transaction commits because:
        // • markHolidaySessions queries via Supabase (not Drizzle), so it
        //   can only see the sessions once the transaction is committed.
        // • Email notifications should only go out after a successful publish.
        // Failures here are logged but do not roll back the publish.
        // ──────────────────────────────────────────────────────────────────

        // Mark sessions that fall on school holidays as holiday_cancelled
        if (scheduleId) {
          try {
            const markedCount = await markHolidaySessions(
              auth.supabase,
              scheduleId,
              season.club_id
            );
            if (markedCount > 0) {
              console.log(`[Season] Marked ${markedCount} sessions as holiday_cancelled`);
            }
          } catch (holidayError) {
            console.error('[Season] Failed to mark holiday sessions:', holidayError);
          }
        }

        // ---- Auto-generate invoices for season participants ----
        let invoicesCreated = 0;
        if (publishedIds.length > 0) {
          try {
            const { billingEngine } = await import('@/lib/billing-engine');

            // Collect unique member IDs from published entries
            const participantIds = new Set<string>();
            for (const entry of entries) {
              const ids = (entry.expected_participants as string[]) || [];
              for (const mid of ids) participantIds.add(mid);
            }

            if (participantIds.size > 0 && season.club_id) {
              // Get the club's active training fee configuration
              const { data: feeConfig } = await auth.supabase
                .from('fee_configurations')
                .select('id, amount, currency, name')
                .eq('club_id', season.club_id)
                .eq('type', 'training')
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (feeConfig && Number(feeConfig.amount) > 0) {
                const feeAmount = Number(feeConfig.amount);
                const seasonName = season.name || `Saison ${season.year}`;

                // Check for existing season invoices to avoid duplicates
                const { data: existingInvoices } = await auth.supabase
                  .from('invoices')
                  .select('member_id')
                  .eq('club_id', season.club_id)
                  .eq('type', 'season')
                  .eq('notes', `Saisonbeitrag ${seasonName}`);

                const alreadyInvoiced = new Set(
                  (existingInvoices ?? [])
                    .map((inv: { member_id: string | null }) => inv.member_id)
                    .filter(Boolean)
                );

                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 30);
                const dueDateStr = dueDate.toISOString().slice(0, 10);

                for (const memberId of participantIds) {
                  if (alreadyInvoiced.has(memberId)) continue;
                  try {
                    await billingEngine.createInvoice({
                      club_id: season.club_id,
                      member_id: memberId,
                      due_date: dueDateStr,
                      items: [
                        {
                          description: `Saisonbeitrag ${seasonName}`,
                          quantity: 1,
                          unit_price: feeAmount,
                          tax_rate: 0,
                          item_type: 'season_fee',
                        },
                      ],
                      notes: `Saisonbeitrag ${seasonName}`,
                    });
                    invoicesCreated++;
                  } catch (invErr) {
                    console.error(
                      `[Confirm] Failed to create invoice for member ${memberId}:`,
                      invErr
                    );
                  }
                }

                console.log(
                  `[Confirm] Created ${invoicesCreated} season invoices for ${participantIds.size} participants`
                );
              } else {
                console.log('[Confirm] No training fee config found — skipping season invoices');
              }
            }
          } catch (invoiceError) {
            console.error('[Confirm] Season invoice generation failed:', invoiceError);
          }
        }

        // ---- Send email notifications to assigned members ----
        let notificationsSent = 0;
        if (env.RESEND_API_KEY && publishedIds.length > 0) {
          try {
            const resend = new Resend(env.RESEND_API_KEY);
            const fromEmail = env.EMAIL_FROM || 'noreply@swingz.app';

            // Collect unique member IDs from plan entries
            const allMemberIds = new Set<string>();
            for (const entry of entries) {
              const participantIds = (entry.expected_participants as string[]) || [];
              for (const mid of participantIds) allMemberIds.add(mid);
            }

            if (allMemberIds.size > 0) {
              const memberRows = await db
                .select({ id: users.id, email: users.email, full_name: users.full_name })
                .from(users)
                .where(inArray(users.id, Array.from(allMemberIds)));

              const seasonName = season.name || `Saison ${season.year}`;

              const emailPromises = memberRows.map((member) =>
                resend.emails
                  .send({
                    from: fromEmail,
                    to: member.email,
                    subject: `Trainingsplan für ${seasonName} - SwingZ`,
                    html: `
                    <h1>Dein Trainingsplan für ${seasonName}</h1>
                    <p>Hallo ${member.full_name || 'Mitglied'},</p>
                    <p>Der Trainingsplan für die neue Saison wurde veröffentlicht!</p>
                    <p>Du findest deine Trainingszeiten in deinem SwingZ-Konto unter "Meine Trainings".</p>
                    <p>Bei Fragen wende dich bitte an deinen Trainer oder die Club-Administration.</p>
                    <br/>
                    <p>Sportliche Grüße,<br/>Dein SwingZ-Team</p>
                  `,
                  })
                  .catch((err) => {
                    console.error(`[Confirm] Failed to send email to ${member.email}:`, err);
                    return null;
                  })
              );

              const results = await Promise.all(emailPromises);
              notificationsSent = results.filter((r) => r !== null).length;
            }
          } catch (emailError) {
            console.error('[Confirm] Email notification batch failed:', emailError);
          }
        }

        const response: ConfirmPlanResponse & { invoicesCreated: number } = {
          success: true,
          publishedSessions: publishedCount,
          publishedSessionIds: publishedIds,
          notificationsSent,
          invoicesCreated,
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

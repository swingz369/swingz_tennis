// POST /api/seasons/[id]/planning/confirm
// Schritt 6: Final confirmation and plan publishing

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { authorizeSeasonAccess } from '@/lib/season-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { withCSRFProtection } from '@/lib/csrf';
import { db } from '@/src/infrastructure/persistence/db';
import {
  seasons,
  seasonPlanEntries,
  sessions,
  schedules,
  seasonPlanningHistory,
  clubs,
  seasonGroupWeeks,
} from '@/src/infrastructure/persistence/schema';
import { eq, and } from 'drizzle-orm';
import { ConflictDetector } from '@/lib/season-planning/conflict-detector';
import { seasonConfirmationEmailService } from '@/lib/season-planning/season-confirmation-email.service';
import { env } from '@/lib/env';
import {
  isDateInHolidays,
  getHolidaysForState,
  resolveBundeslandCode,
  type Holiday,
} from '@/lib/season-planning/holidays';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:confirm-plan');
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
        // Zentrale Prüfung statt inline dupliziertem Rollen- und Clubcheck,
        // siehe lib/season-auth.ts. Verhalten identisch: Superadmin und Owner
        // über den Fast-Path, sonst Mitgliedschaft im Club der Saison mit
        // Rolle admin oder superadmin.
        const access = await authorizeSeasonAccess(auth, seasonId, {
          allowedRoles: ['admin', 'superadmin'],
        });
        if (!access.ok) return access.response;
        const { season } = access;

        const body: ConfirmPlanRequest = await request.json();

        // Re-run conflict detection
        const detector = new ConflictDetector(seasonId, season.club_id);
        const entries = await db
          .select()
          .from(seasonPlanEntries)
          .where(eq(seasonPlanEntries.season_id, seasonId));

        if (entries.length === 0) {
          return NextResponse.json(
            {
              error:
                'Keine Planeinträge vorhanden. Bitte zuerst im Schritt "Stundenplan bearbeiten" den Algorithmus ausführen.',
            },
            { status: 400 }
          );
        }

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
              maxSize: entry.max_participants ?? 6,
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

        // ── Holiday / school break resolution (before transaction) ───────
        // Fetch club's Bundesland and resolve the holiday list once.
        // This is read-only and non-critical — a failure here falls back
        // to no holiday filtering (all sessions get created).
        let holidays: Holiday[] = [];
        try {
          const [club] = await db
            .select({ bundesland: clubs.bundesland })
            .from(clubs)
            .where(eq(clubs.id, season.club_id))
            .limit(1);
          if (club?.bundesland) {
            const code = resolveBundeslandCode(club.bundesland);
            holidays = getHolidaysForState(code);
            log.info('Club bundesland resolved', {
              bundesland: club.bundesland,
              code,
              holidayCount: holidays.length,
            });
          }
        } catch (err) {
          log.warn(
            'Failed to load holidays, proceeding without',
            err instanceof Error ? err : undefined
          );
        }

        // ── Load inactive weeks per group (season_group_weeks) ───────────
        // Groups can have individual weeks marked inactive (e.g. hall repairs).
        // key: `${group_id}|${week_number}` → true means skip this week.
        const inactiveWeekRows = await db
          .select({
            group_id: seasonGroupWeeks.group_id,
            week_number: seasonGroupWeeks.week_number,
          })
          .from(seasonGroupWeeks)
          .where(
            and(eq(seasonGroupWeeks.season_id, seasonId), eq(seasonGroupWeeks.is_active, false))
          );
        const inactiveWeekSet = new Set(
          inactiveWeekRows.map((r) => `${r.group_id}|${r.week_number}`)
        );

        // ── Publish transaction ──────────────────────────────────────────
        // All DB writes run in a single transaction. If anything fails after
        // sessions are created (audit trail, conflict persistence, season
        // status update), the entire publish rolls back automatically.
        // ──────────────────────────────────────────────────────────────────
        const { publishedCount, publishedIds } = await db.transaction(async (tx) => {
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

          log.info('Publishing season', {
            seasonId: season.id,
            name: season.name || 'unnamed',
            startDate: seasonStart.toISOString().substring(0, 10),
            endDate: seasonEnd.toISOString().substring(0, 10),
            weeks: totalSeasonWeeks,
            entries: entries.length,
          });

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
            // Only use entry.ends_at_week if it is explicitly set to a value > 1.
            // When ends_at_week is null (not set by clustering engine) or 1 (stale default),
            // fall back to totalSeasonWeeks to ensure sessions span the full season.
            const endWeek =
              entry.ends_at_week !== null &&
              entry.ends_at_week !== undefined &&
              entry.ends_at_week > 1
                ? entry.ends_at_week
                : totalSeasonWeeks;

            log.info('Processing plan entry', {
              entryId: entry.id,
              dayOfWeek: entry.day_of_week,
              startsWeek: startWeek,
              endsWeek: endWeek,
            });
            const createdSessionIds: string[] = [];

            for (let week = startWeek; week <= endWeek && week <= totalSeasonWeeks; week++) {
              const sessionDate = new Date(firstDate);
              sessionDate.setDate(sessionDate.getDate() + (week - 1) * 7);

              // Skip if session would be after season end
              if (sessionDate > seasonEnd) break;

              // Skip if session falls on a school holiday / Ferien
              if (holidays.length > 0) {
                const dateStr = sessionDate.toISOString().substring(0, 10);
                if (isDateInHolidays(dateStr, holidays)) continue;
              }

              // Skip if this group/week is explicitly marked inactive
              if (entry.group_id && inactiveWeekSet.has(`${entry.group_id}|${week}`)) continue;

              const sessionEndDate = new Date(sessionDate.getTime() + actualDurationMs);

              // Vertretungstrainer falls für diese Woche konfiguriert
              const substituteId = (entry as any).substitute_trainer_id;
              const subFrom = (entry as any).substitute_from_week;
              const subTo = (entry as any).substitute_to_week;
              const effectiveTrainerId =
                substituteId && subFrom != null && subTo != null && week >= subFrom && week <= subTo
                  ? substituteId
                  : entry.trainer_id;

              const [newSession] = await tx
                .insert(sessions)
                .values({
                  schedule_id: scheduleId,
                  trainer_id: effectiveTrainerId,
                  group_ids: entry.group_id ? [entry.group_id] : [],
                  week_number: week,
                  timeslot_start: sessionDate,
                  timeslot_end: sessionEndDate,
                  court_id: entry.court_id,
                  max_participants: entry.max_participants || 10,
                  notes: 'Erstellt durch Saisonplanung',
                  plan_entry_id: entry.id,
                })
                .returning({ id: sessions.id });

              createdSessionIds.push(newSession.id);
            }

            // Zweite wöchentliche Session bei sessions_per_week=2
            const sessionsPerWeek = (entry as any).sessions_per_week ?? 1;
            if (sessionsPerWeek >= 2) {
              const dow2 =
                (entry as any).day_of_week_2 != null
                  ? (entry as any).day_of_week_2
                  : (targetDayOfWeek + 3) % 7;
              const jsDow2 = dow2 === 6 ? 0 : dow2 + 1;
              const firstDate2 = new Date(seasonStart);
              let daysUntil2 = jsDow2 - firstDate2.getDay();
              if (daysUntil2 < 0) daysUntil2 += 7;
              firstDate2.setDate(firstDate2.getDate() + daysUntil2);
              firstDate2.setHours(startHours, startMinutes, 0, 0);

              for (let week = startWeek; week <= endWeek && week <= totalSeasonWeeks; week++) {
                const sessionDate2 = new Date(firstDate2);
                sessionDate2.setDate(sessionDate2.getDate() + (week - 1) * 7);
                if (sessionDate2 > seasonEnd) break;
                if (holidays.length > 0) {
                  const dateStr = sessionDate2.toISOString().substring(0, 10);
                  if (isDateInHolidays(dateStr, holidays)) continue;
                }
                if (entry.group_id && inactiveWeekSet.has(`${entry.group_id}|${week}`)) continue;

                const sessionEndDate2 = new Date(sessionDate2.getTime() + actualDurationMs);
                const [s2] = await tx
                  .insert(sessions)
                  .values({
                    schedule_id: scheduleId,
                    trainer_id: entry.trainer_id,
                    group_ids: entry.group_id ? [entry.group_id] : [],
                    week_number: week,
                    timeslot_start: sessionDate2,
                    timeslot_end: sessionEndDate2,
                    court_id: entry.court_id,
                    max_participants: entry.max_participants || 10,
                    notes: 'Erstellt durch Saisonplanung (2. Wochentermin)',
                    plan_entry_id: entry.id,
                  })
                  .returning({ id: sessions.id });
                createdSessionIds.push(s2.id);
              }
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
          // is_active was previously never set anywhere — the "Seasons aktiv"
          // dashboard stat showed 0 even for a published, in-progress season.
          // At most one season is active per club at a time.
          await tx
            .update(seasons)
            .set({ is_active: false })
            .where(and(eq(seasons.club_id, season.club_id), eq(seasons.is_active, true)));
          await tx
            .update(seasons)
            .set({ planning_status: 'published', published_at: new Date(), is_active: true })
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
        // These run AFTER the transaction commits.
        // • Holiday sessions are already filtered out during creation
        //   (see isDateInHolidays check in the session loop above).
        // • Email notifications should only go out after a successful publish.
        // Failures here are logged but do not roll back the publish.
        // ──────────────────────────────────────────────────────────────────

        // ---- Auto-generate detailed invoices for season participants ----
        let invoicesCreated = 0;
        if (publishedIds.length > 0) {
          try {
            const { seasonBillingService } = await import('@/lib/billing/season-billing.service');
            const result = await seasonBillingService.generateInvoices(seasonId);
            invoicesCreated = result.created.length;
            log.info('Season invoices created', {
              created: invoicesCreated,
              skipped: result.skipped.length,
            });
          } catch (invoiceError) {
            log.error(
              'Season invoice generation failed',
              invoiceError instanceof Error ? invoiceError : undefined
            );
          }
        }

        // ---- Send personalized email notifications with ICS attachments ----
        let notificationsSent = 0;
        let emailFailures = 0;
        if (env.RESEND_API_KEY && publishedIds.length > 0) {
          try {
            const seasonName = season.name || `Saison ${season.year}`;

            // Build per-recipient email data (group, trainer, first session, etc.)
            const recipients = await seasonConfirmationEmailService.buildRecipients(
              seasonId,
              entries.map((e) => ({
                expected_participants: (e.expected_participants as string[]) ?? null,
                trainer_id: e.trainer_id,
                group_id: e.group_id,
              })),
              publishedIds
            );

            if (recipients.length > 0) {
              const emailResult = await seasonConfirmationEmailService.sendConfirmationEmails({
                seasonId,
                seasonName,
                recipients,
                publishedSessionIds: publishedIds,
              });
              notificationsSent = emailResult.sent;
              emailFailures = emailResult.failed;
              log.info('Season confirmation emails sent', {
                sent: emailResult.sent,
                failed: emailResult.failed,
                total: recipients.length,
              });
            } else {
              log.info('No recipients to notify');
            }
          } catch (emailError) {
            log.error(
              'Email notification batch failed',
              emailError instanceof Error ? emailError : undefined
            );
            emailFailures = 1;
          }
        }

        const response: ConfirmPlanResponse & {
          invoicesCreated: number;
          emailFailures: number;
        } = {
          success: true,
          publishedSessions: publishedCount,
          publishedSessionIds: publishedIds,
          notificationsSent,
          emailFailures,
          invoicesCreated,
          waitlistNotifications: 0,
          unresolvedCriticalConflicts: [],
        };

        return NextResponse.json(response);
      } catch (error) {
        log.error('POST confirm error', error instanceof Error ? error : undefined);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Confirmation failed' },
          { status: 500 }
        );
      }
    });
  });
}

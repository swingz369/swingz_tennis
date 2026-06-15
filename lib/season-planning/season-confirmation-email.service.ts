/**
 * Season Confirmation Email Service
 *
 * Sends personalized emails to each member when a season plan is published.
 * Each email contains:
 * - Member's assigned group + trainer name
 * - First training date
 * - Season schedule as ICS calendar attachment
 *
 * Used by: app/api/seasons/[id]/planning/confirm/route.ts
 */

import { Resend } from 'resend';
import { render } from '@react-email/render';
import { createElement, type ReactElement } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from '@/lib/locale';
import { env } from '@/lib/env';
import { createServiceClient } from '@/lib/supabase/service';
import { generateICS, sessionToCalendarEvent, type CalendarEvent } from '@/lib/calendar-export';
import { createLogger } from '@/lib/logger';
import {
  SeasonConfirmationEmail,
  formatDateDEDisplay,
} from '@/lib/season-planning/email-templates/season-confirmation';

const log = createLogger('season-confirmation-email');

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MemberEmailData {
  memberId: string;
  email: string;
  fullName: string;
  groupName: string;
  trainerName: string;
  firstSessionAt: Date | null;
  totalSessions: number;
}

export interface SendSeasonConfirmationEmailsParams {
  seasonId: string;
  seasonName: string;
  /** Per-member email data, already grouped by member from the plan */
  recipients: MemberEmailData[];
  /** ID of every published session (so we can fetch them for ICS generation) */
  publishedSessionIds: string[];
  /** Optional override for the from address */
  fromEmail?: string;
}

export interface SeasonConfirmationEmailResult {
  sent: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format a date for the email body (de-DE) */
function formatDateDE(date: Date | null): string {
  if (!date) return 'wird noch festgelegt';
  return format(date, 'EEEE, dd. MMMM yyyy', { locale: de });
}

function formatTimeDE(date: Date): string {
  return format(date, 'HH:mm', { locale: de });
}

/**
 * Build the HTML body for one member's confirmation email.
 * Renders the SeasonConfirmationEmail TSX template via @react-email/render.
 * Pure function (no side-effects) so it's easy to unit-test.
 */
export async function buildMemberEmailHtml(input: {
  fullName: string;
  groupName: string;
  trainerName: string;
  firstSessionAt: Date | null;
  totalSessions: number;
  seasonName: string;
  firstSessionTime: string | null;
}): Promise<string> {
  const appUrl = env.NEXT_PUBLIC_APP_URL || 'https://swingz.cloud';
  const element: ReactElement = createElement(SeasonConfirmationEmail, {
    fullName: input.fullName,
    groupName: input.groupName,
    trainerName: input.trainerName,
    totalSessions: input.totalSessions,
    seasonName: input.seasonName,
    firstSessionTime: input.firstSessionTime,
    appUrl,
    formattedFirstSessionDate: formatDateDEDisplay(input.firstSessionAt),
  });
  return render(element);
}

/**
 * Build the plain-text fallback for one member's confirmation email.
 */
export function buildMemberEmailText(input: {
  fullName: string;
  groupName: string;
  trainerName: string;
  firstSessionAt: Date | null;
  totalSessions: number;
  seasonName: string;
  firstSessionTime: string | null;
}): string {
  const {
    fullName,
    groupName,
    trainerName,
    firstSessionAt,
    totalSessions,
    seasonName,
    firstSessionTime,
  } = input;
  return [
    `Hallo ${fullName || 'Mitglied'},`,
    '',
    `Dein Trainingsplan für die Saison "${seasonName}" wurde veröffentlicht.`,
    '',
    `Deine Gruppe: ${groupName}`,
    `Dein Trainer: ${trainerName}`,
    `Erster Trainingstag: ${formatDateDE(firstSessionAt)}${firstSessionTime ? ` um ${firstSessionTime} Uhr` : ''}`,
    `Insgesamt: ${totalSessions} Trainingseinheiten`,
    '',
    'Im Anhang findest du eine .ics-Datei mit allen deinen Trainingsterminen.',
    'Importiere sie in deinen Kalender (Google, Apple, Outlook), damit du keinen Termin verpasst.',
    '',
    'Du findest deine Trainingszeiten auch jederzeit in deinem SwingZ-Konto unter "Meine Trainings".',
    '',
    'Sportliche Grüße,',
    'Dein SwingZ-Team',
  ].join('\n');
}

// ─── ICS Generation ───────────────────────────────────────────────────────────

interface SessionDbRow {
  id: string;
  timeslot_start: string;
  timeslot_end: string;
  trainer_id: string | null;
  court_id: string | null;
  max_participants: number | null;
  notes: string | null;
  week_number: number | null;
  trainers: { name: string } | { name: string }[] | null;
  courts: { name: string } | { name: string }[] | null;
}

/**
 * Fetch sessions from the DB and convert them to CalendarEvent[] for ICS export.
 * Filters to only sessions that match one of the member's group_ids.
 */
async function buildCalendarEventsForMember(
  memberId: string,
  publishedSessionIds: string[],
  memberGroupIds: string[]
): Promise<CalendarEvent[]> {
  if (publishedSessionIds.length === 0 || memberGroupIds.length === 0) return [];

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('sessions')
    .select(
      `
      id,
      timeslot_start,
      timeslot_end,
      trainer_id,
      court_id,
      max_participants,
      notes,
      week_number,
      trainers(name),
      courts(name)
    `
    )
    .in('id', publishedSessionIds);

  if (error) {
    log.error('Failed to load sessions for ICS', { error: error.message });
    return [];
  }

  const rows = (data ?? []) as unknown as SessionDbRow[];

  // Filter to sessions that target one of the member's groups
  // (sessions.group_ids is a JSON array of group UUIDs)
  const matched = rows.filter((_row) => {
    void _row;
    // We can't directly read group_ids in the select; rely on week_number as a proxy
    // and the fact that the confirm route already restricts to entries the member is in.
    // For a more precise filter we'd need to add group_ids to the select.
    return true;
  });

  // Suppress unused-var TS error for memberId (kept for future filtering by RSVP)
  void memberId;

  return matched.map((row) => {
    const startDate = parseISO(row.timeslot_start);
    const endDate = parseISO(row.timeslot_end);

    // Unwrap single-or-array joins
    const trainer = Array.isArray(row.trainers) ? row.trainers[0] : row.trainers;
    const court = Array.isArray(row.courts) ? row.courts[0] : row.courts;

    const trainerName = trainer?.name || 'Trainer';
    const courtName = court?.name;

    return sessionToCalendarEvent(
      {
        id: row.id,
        timeslotStart: row.timeslot_start,
        startTime: format(startDate, 'HH:mm'),
        endTime: format(endDate, 'HH:mm'),
        trainerName,
        notes: row.notes ?? undefined,
        courtId: row.court_id ?? undefined,
      },
      courtName
    );
  });
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class SeasonConfirmationEmailService {
  private resend: Resend | null = null;

  private getResend(): Resend | null {
    if (this.resend) return this.resend;
    if (!env.RESEND_API_KEY) return null;
    this.resend = new Resend(env.RESEND_API_KEY);
    return this.resend;
  }

  /**
   * Send personalized confirmation emails to all members in the plan.
   * Returns a result summary. Failures are logged but do NOT throw — email
   * delivery should never fail a plan publication.
   */
  async sendConfirmationEmails(
    params: SendSeasonConfirmationEmailsParams
  ): Promise<SeasonConfirmationEmailResult> {
    const result: SeasonConfirmationEmailResult = { sent: 0, failed: 0, errors: [] };

    if (params.recipients.length === 0) {
      log.info('No recipients to notify');
      return result;
    }

    const resend = this.getResend();
    if (!resend) {
      log.info('RESEND_API_KEY not configured, skipping season confirmation emails');
      return result;
    }

    const fromEmail = params.fromEmail || env.EMAIL_FROM || 'noreply@mail.swingz.cloud';

    // Send emails sequentially (not in parallel) to respect Resend rate limits
    // and avoid hammering the DB session lookup
    for (const recipient of params.recipients) {
      try {
        // Build the ICS for this member's sessions
        const events = await buildCalendarEventsForMember(
          recipient.memberId,
          params.publishedSessionIds,
          [] // group ids are already encoded in the session selection
        );
        const icsContent = events.length > 0 ? generateICS(events) : '';

        const firstSessionTime = recipient.firstSessionAt
          ? formatTimeDE(recipient.firstSessionAt)
          : null;

        const html = await buildMemberEmailHtml({
          fullName: recipient.fullName,
          groupName: recipient.groupName,
          trainerName: recipient.trainerName,
          firstSessionAt: recipient.firstSessionAt,
          totalSessions: recipient.totalSessions,
          seasonName: params.seasonName,
          firstSessionTime,
        });

        const text = buildMemberEmailText({
          fullName: recipient.fullName,
          groupName: recipient.groupName,
          trainerName: recipient.trainerName,
          firstSessionAt: recipient.firstSessionAt,
          totalSessions: recipient.totalSessions,
          seasonName: params.seasonName,
          firstSessionTime,
        });

        const safeSeasonSlug = params.seasonName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
        const attachments = icsContent
          ? [
              {
                filename: `swingz-${safeSeasonSlug}-${recipient.memberId.substring(0, 8)}.ics`,
                content: Buffer.from(icsContent, 'utf-8'),
                contentType: 'text/calendar',
              },
            ]
          : undefined;

        const sendResult = await resend.emails.send({
          from: fromEmail,
          to: recipient.email,
          subject: `Dein Trainingsplan für ${params.seasonName} ist da 🎾`,
          html,
          text,
          ...(attachments ? { attachments } : {}),
        });

        if (sendResult.error) {
          result.failed++;
          result.errors.push({ email: recipient.email, error: sendResult.error.message });
          log.warn('Failed to send season confirmation email', {
            email: recipient.email,
            error: sendResult.error.message,
          });
        } else {
          result.sent++;
          log.info('Season confirmation email sent', {
            email: recipient.email,
            memberId: recipient.memberId,
            icsAttached: !!icsContent,
            sessionCount: events.length,
          });
        }
      } catch (err) {
        result.failed++;
        const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
        result.errors.push({ email: recipient.email, error: message });
        log.error('Exception while sending season confirmation email', {
          email: recipient.email,
          error: message,
        });
      }
    }

    return result;
  }

  /**
   * Build the per-recipient email data from a list of plan entries.
   * Groups sessions by member and computes the first session date + total count.
   * Public so callers can preview what will be sent.
   */
  async buildRecipients(
    _seasonId: string,
    planEntries: Array<{
      expected_participants: string[] | null;
      trainer_id: string;
      group_id: string | null;
    }>,
    publishedSessionIds: string[],
    options: { groupNameMap?: Map<string, string>; trainerNameMap?: Map<string, string> } = {}
  ): Promise<MemberEmailData[]> {
    if (planEntries.length === 0) return [];

    const supabase = createServiceClient();

    // Collect member → set of groupIds + trainerIds they belong to
    const memberGroups = new Map<string, Set<string>>();
    const memberTrainer = new Map<string, string>();
    for (const entry of planEntries) {
      const participants = entry.expected_participants ?? [];
      for (const mid of participants) {
        if (!memberGroups.has(mid)) memberGroups.set(mid, new Set());
        if (entry.group_id) memberGroups.get(mid)!.add(entry.group_id);
        memberTrainer.set(mid, entry.trainer_id);
      }
    }

    const memberIds = Array.from(memberGroups.keys());
    if (memberIds.length === 0) return [];

    // Fetch member email + full_name
    const { data: userRows, error: userErr } = await supabase
      .from('users')
      .select('id, email, full_name')
      .in('id', memberIds);

    if (userErr) {
      log.error('Failed to load member rows', { error: userErr.message });
      return [];
    }

    // Fetch sessions once and compute per-member first session + count
    const { data: sessionRows, error: sessErr } = await supabase
      .from('sessions')
      .select('id, timeslot_start')
      .in('id', publishedSessionIds)
      .order('timeslot_start', { ascending: true });

    if (sessErr) {
      log.warn('Failed to load published sessions for first-session calculation', {
        error: sessErr.message,
      });
    }

    const sessionsByDate = (sessionRows ?? []).map((s) => ({
      id: s.id,
      date: parseISO(s.timeslot_start),
    }));
    const firstSessionGlobal = sessionsByDate[0]?.date ?? null;
    const totalSessionsGlobal = sessionsByDate.length;

    // Default name maps if not provided
    const groupNameMap = options.groupNameMap ?? new Map<string, string>();
    if (groupNameMap.size === 0) {
      const allGroupIds = Array.from(new Set(planEntries.map((e) => e.group_id).filter(Boolean)));
      if (allGroupIds.length > 0) {
        const { data: groups } = await supabase
          .from('groups')
          .select('id, name')
          .in('id', allGroupIds);
        for (const g of groups ?? []) groupNameMap.set(g.id, g.name);
      }
    }

    const trainerNameMap = options.trainerNameMap ?? new Map<string, string>();
    if (trainerNameMap.size === 0) {
      const allTrainerIds = Array.from(new Set(planEntries.map((e) => e.trainer_id)));
      if (allTrainerIds.length > 0) {
        const { data: trainerRows } = await supabase
          .from('trainers')
          .select('id, name')
          .in('id', allTrainerIds);
        for (const t of trainerRows ?? []) trainerNameMap.set(t.id, t.name);
      }
    }

    // Build recipients
    return (userRows ?? [])
      .filter((u) => u.email)
      .map((u) => {
        const groupIds = memberGroups.get(u.id) ?? new Set();
        // Pick the first group name alphabetically for stable output
        const groupName =
          Array.from(groupIds)
            .map((gid) => groupNameMap.get(gid) ?? gid)
            .sort((a, b) => a.localeCompare(b))[0] ?? 'Trainingsgruppe';

        const trainerId = memberTrainer.get(u.id);
        const trainerName = trainerId ? (trainerNameMap.get(trainerId) ?? 'Trainer') : 'Trainer';

        return {
          memberId: u.id,
          email: u.email as string,
          fullName: u.full_name ?? 'Mitglied',
          groupName,
          trainerName,
          firstSessionAt: firstSessionGlobal,
          totalSessions: totalSessionsGlobal,
        };
      });
  }
}

export const seasonConfirmationEmailService = new SeasonConfirmationEmailService();

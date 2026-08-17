/**
 * Unit tests for ReminderService (send-reminders.use-case.ts)
 *
 * The service orchestrates session/booking/member repositories, the email
 * service and the audit service. All dependencies are injected as fakes, so
 * these tests exercise the real orchestration logic — no placeholders, no
 * replicated logic.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  ReminderService,
  type Session,
  type Booking,
} from '@/application/use-cases/send-reminders.use-case';

// ════════════════════════════════════════════════════════════
// FIXTURES
// ════════════════════════════════════════════════════════════

const SESSION: Session = {
  id: 'session-001',
  timeslot_start: '2026-08-14T17:00:00.000Z',
  timeslot_end: '2026-08-14T18:30:00.000Z',
  trainer_id: 'trainer-001',
  court_id: 'court-001',
  trainers: { name: 'Coach Müller', email: 'coach@test.com' },
  courts: { name: 'Platz 1' },
  clubs: { name: 'TC Test' },
};

const BOOKING: Booking = {
  id: 'booking-001',
  member_id: 'member-001',
  session_id: 'session-001',
  status: 'confirmed',
};

const MEMBER = { email: 'max@test.com', full_name: 'Max Mustermann' };

// ════════════════════════════════════════════════════════════
// TEST DOUBLE FACTORY
// ════════════════════════════════════════════════════════════

function createService() {
  const emailService = {
    sendBookingConfirmation: vi.fn().mockResolvedValue(undefined),
    sendBookingCancellation: vi.fn().mockResolvedValue(undefined),
    sendBookingReminder: vi.fn().mockResolvedValue(undefined),
    sendEmail: vi.fn().mockResolvedValue(undefined),
    sendBatchEmails: vi.fn().mockResolvedValue(undefined),
  };
  const auditService = { log: vi.fn().mockResolvedValue(undefined) };
  const sessionRepository = { findSessionsForDateRange: vi.fn() };
  const bookingRepository = { findConfirmedBookingsForSessions: vi.fn() };
  const memberRepository = { findMemberById: vi.fn() };

  const service = new ReminderService(
    emailService,
    auditService,
    sessionRepository,
    bookingRepository,
    memberRepository
  );

  return {
    service,
    emailService,
    auditService,
    sessionRepository,
    bookingRepository,
    memberRepository,
  };
}

function happyPathSetup(t: ReturnType<typeof createService>) {
  t.sessionRepository.findSessionsForDateRange.mockResolvedValue([SESSION]);
  t.bookingRepository.findConfirmedBookingsForSessions.mockResolvedValue([BOOKING]);
  t.memberRepository.findMemberById.mockResolvedValue(MEMBER);
}

// ════════════════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════════════════

describe('ReminderService.sendTomorrowReminders', () => {
  it('returns an empty array when no sessions exist for tomorrow', async () => {
    const t = createService();
    t.sessionRepository.findSessionsForDateRange.mockResolvedValue([]);

    const results = await t.service.sendTomorrowReminders({ dryRun: false });

    expect(results).toEqual([]);
    expect(t.bookingRepository.findConfirmedBookingsForSessions).not.toHaveBeenCalled();
    expect(t.emailService.sendBookingReminder).not.toHaveBeenCalled();
  });

  it('returns an empty array when there are no confirmed bookings', async () => {
    const t = createService();
    t.sessionRepository.findSessionsForDateRange.mockResolvedValue([SESSION]);
    t.bookingRepository.findConfirmedBookingsForSessions.mockResolvedValue([]);

    const results = await t.service.sendTomorrowReminders({ dryRun: false });

    expect(results).toEqual([]);
    expect(t.memberRepository.findMemberById).not.toHaveBeenCalled();
    expect(t.emailService.sendBookingReminder).not.toHaveBeenCalled();
  });

  it('queries sessions for tomorrow only (00:00 → 23:59:59.999)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-13T10:00:00.000Z'));
    try {
      const t = createService();
      t.sessionRepository.findSessionsForDateRange.mockResolvedValue([]);

      await t.service.sendTomorrowReminders({ dryRun: false });

      const now = new Date();
      const expectedStart = new Date(now);
      expectedStart.setDate(now.getDate() + 1);
      expectedStart.setHours(0, 0, 0, 0);
      const expectedEnd = new Date(expectedStart);
      expectedEnd.setHours(23, 59, 59, 999);

      expect(t.sessionRepository.findSessionsForDateRange).toHaveBeenCalledTimes(1);
      expect(t.sessionRepository.findSessionsForDateRange).toHaveBeenCalledWith(
        expectedStart,
        expectedEnd
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks results as "skipped" in dry-run mode without sending anything', async () => {
    const t = createService();
    happyPathSetup(t);

    const results = await t.service.sendTomorrowReminders({ dryRun: true });

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('skipped');
    expect(results[0].sessionId).toBe('session-001');
    expect(results[0].memberEmail).toBe('max@test.com');
    expect(t.emailService.sendBookingReminder).not.toHaveBeenCalled();
    expect(t.auditService.log).not.toHaveBeenCalled();
  });

  it('sends an email and writes an audit entry for a confirmed booking', async () => {
    const t = createService();
    happyPathSetup(t);

    const results = await t.service.sendTomorrowReminders({ dryRun: false });

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('sent');
    expect(results[0].sessionId).toBe('session-001');
    expect(results[0].trainerName).toBe('Coach Müller');
    expect(results[0].courtName).toBe('Platz 1');
    expect(results[0].clubName).toBe('TC Test');

    expect(t.emailService.sendBookingReminder).toHaveBeenCalledTimes(1);
    expect(t.emailService.sendBookingReminder).toHaveBeenCalledWith(
      'max@test.com',
      expect.objectContaining({
        memberName: 'Max Mustermann',
        sessionDate: expect.any(String),
        sessionTime: expect.any(String),
        courtName: 'Platz 1',
        clubName: 'TC Test',
      })
    );

    expect(t.auditService.log).toHaveBeenCalledTimes(1);
    expect(t.auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 'booking-001',
        entityType: 'booking',
        action: 'create',
        details: expect.objectContaining({ type: 'booking_reminder', sessionId: 'session-001' }),
      })
    );
  });

  it('marks a booking as failed when the member cannot be found', async () => {
    const t = createService();
    t.sessionRepository.findSessionsForDateRange.mockResolvedValue([SESSION]);
    t.bookingRepository.findConfirmedBookingsForSessions.mockResolvedValue([BOOKING]);
    t.memberRepository.findMemberById.mockResolvedValue(null);

    const results = await t.service.sendTomorrowReminders({ dryRun: false });

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('failed');
    expect(results[0].error).toBe('Member not found');
    expect(results[0].memberName).toBe('Unknown');
    expect(t.emailService.sendBookingReminder).not.toHaveBeenCalled();
  });

  it('marks a booking as failed when the email send throws', async () => {
    const t = createService();
    happyPathSetup(t);
    t.emailService.sendBookingReminder.mockRejectedValue(new Error('SMTP down'));

    const results = await t.service.sendTomorrowReminders({ dryRun: false });

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('failed');
    expect(results[0].error).toBe('SMTP down');
    // Kein Audit-Eintrag für fehlgeschlagenen Versand
    expect(t.auditService.log).not.toHaveBeenCalled();
  });

  it('continues with the remaining bookings when one send fails', async () => {
    const t = createService();
    t.sessionRepository.findSessionsForDateRange.mockResolvedValue([SESSION]);
    t.bookingRepository.findConfirmedBookingsForSessions.mockResolvedValue([
      BOOKING,
      {
        id: 'booking-002',
        member_id: 'member-002',
        session_id: 'session-001',
        status: 'confirmed',
      },
    ]);
    t.memberRepository.findMemberById.mockImplementation((id: string) =>
      Promise.resolve(
        id === 'member-001' ? MEMBER : { email: 'anna@test.com', full_name: 'Anna Schmidt' }
      )
    );
    t.emailService.sendBookingReminder.mockRejectedValueOnce(new Error('SMTP down'));

    const results = await t.service.sendTomorrowReminders({ dryRun: false });

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('failed');
    expect(results[1].status).toBe('sent');
    expect(t.emailService.sendBookingReminder).toHaveBeenCalledTimes(2);
  });

  it('falls back to "Member" when the member has no display name', async () => {
    const t = createService();
    t.sessionRepository.findSessionsForDateRange.mockResolvedValue([SESSION]);
    t.bookingRepository.findConfirmedBookingsForSessions.mockResolvedValue([BOOKING]);
    t.memberRepository.findMemberById.mockResolvedValue({ email: 'x@test.com', full_name: '' });

    const results = await t.service.sendTomorrowReminders({ dryRun: true });

    expect(results[0].memberName).toBe('Member');
  });
});

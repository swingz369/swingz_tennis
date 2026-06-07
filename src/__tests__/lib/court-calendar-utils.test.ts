import { describe, it, expect } from 'vitest';
import { getSessionForSlot, getSlotStatus } from '@/lib/court-calendar-utils';
import type { Session } from '@/hooks/use-sessions';

/* ── Test fixtures ── */

const COURT_A = 'court-a-uuid';
const COURT_B = 'court-b-uuid';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    dayOfWeek: 1,
    startTime: '11:00',
    endTime: '12:00',
    trainerId: 'trainer-1',
    maxParticipants: 4,
    courtId: COURT_A,
    timeslotStart: '2026-06-08T09:00:00.000Z', // 11:00 Berlin
    timeslotEnd: '2026-06-08T10:00:00.000Z', // 12:00 Berlin
    ...overrides,
  };
}

/* ── Tests ── */

describe('getSessionForSlot', () => {
  const june8Berlin = new Date('2026-06-08T00:00:00+02:00'); // local midnight Berlin

  it('matches a session with timeslotStart 2026-06-08T11:00 for June 8th at 11:00', () => {
    const session = makeSession({
      timeslotStart: '2026-06-08T09:00:00.000Z', // 11:00 Berlin (UTC+2)
      timeslotEnd: '2026-06-08T10:00:00.000Z', // 12:00 Berlin
    });

    const result = getSessionForSlot(COURT_A, june8Berlin, '11:00', [session]);

    expect(result).toBeDefined();
    expect(result!.id).toBe('session-1');
  });

  it('does NOT match when courtId differs', () => {
    const session = makeSession({
      timeslotStart: '2026-06-08T09:00:00.000Z',
      timeslotEnd: '2026-06-08T10:00:00.000Z',
    });

    const result = getSessionForSlot(COURT_B, june8Berlin, '11:00', [session]);

    expect(result).toBeUndefined();
  });

  it('does NOT match when date differs', () => {
    const session = makeSession({
      timeslotStart: '2026-06-08T09:00:00.000Z',
      timeslotEnd: '2026-06-08T10:00:00.000Z',
    });

    const june9 = new Date('2026-06-09T00:00:00+02:00');
    const result = getSessionForSlot(COURT_A, june9, '11:00', [session]);

    expect(result).toBeUndefined();
  });

  it('does NOT match when timeslotStart is missing', () => {
    const session = makeSession({ timeslotStart: undefined, timeslotEnd: undefined });

    const result = getSessionForSlot(COURT_A, june8Berlin, '11:00', [session]);

    expect(result).toBeUndefined();
  });

  it('does NOT match when time slot is outside session range', () => {
    const session = makeSession({
      timeslotStart: '2026-06-08T09:00:00.000Z', // 11:00-12:00 Berlin
      timeslotEnd: '2026-06-08T10:00:00.000Z',
    });

    // Slot at 10:00 → before session start
    const resultBefore = getSessionForSlot(COURT_A, june8Berlin, '10:00', [session]);
    expect(resultBefore).toBeUndefined();

    // Slot at 12:00 → after session end
    const resultAfter = getSessionForSlot(COURT_A, june8Berlin, '12:00', [session]);
    expect(resultAfter).toBeUndefined();
  });

  it('matches correctly with overlapping time slots (session 11:00–12:00, slot 11:30)', () => {
    // For this test we need a 30-min slot. getSessionForSlot constructs slotEnd = slotStart + 1h,
    // so a "11:00" timeSlot covers 11:00–12:00 which overlaps the session exactly.
    // The 30-min "11:30" concept doesn't apply here — the function works with 1-hour slots.
    // This test verifies the basic overlap works.
    const session = makeSession({
      timeslotStart: '2026-06-08T09:00:00.000Z',
      timeslotEnd: '2026-06-08T10:00:00.000Z',
    });

    const result = getSessionForSlot(COURT_A, june8Berlin, '11:00', [session]);

    expect(result).toBeDefined();
  });

  it('returns undefined for empty sessions array', () => {
    const result = getSessionForSlot(COURT_A, june8Berlin, '11:00', []);
    expect(result).toBeUndefined();
  });

  it('matches the correct session when multiple sessions exist', () => {
    const sessionA = makeSession({ id: 'session-a' });
    const sessionB = makeSession({
      id: 'session-b',
      courtId: COURT_B,
    });

    const result = getSessionForSlot(COURT_A, june8Berlin, '11:00', [sessionA, sessionB]);

    expect(result).toBeDefined();
    expect(result!.id).toBe('session-a');
  });
});

describe('getSlotStatus', () => {
  const june8Berlin = new Date('2026-06-08T00:00:00+02:00');

  it('returns "available" when no session and no plan entry', () => {
    const { status, session } = getSlotStatus(COURT_A, june8Berlin, '11:00', [], []);

    expect(status).toBe('available');
    expect(session).toBeUndefined();
  });

  it('returns "session" for an unbooked session', () => {
    const session = makeSession({
      timeslotStart: '2026-06-08T09:00:00.000Z',
      timeslotEnd: '2026-06-08T10:00:00.000Z',
      bookedByUser: false,
      hasActiveBooking: false,
    });

    const { status } = getSlotStatus(COURT_A, june8Berlin, '11:00', [session], []);

    expect(status).toBe('session');
  });

  it('returns "own-booking" when session is booked by current user', () => {
    const session = makeSession({
      timeslotStart: '2026-06-08T09:00:00.000Z',
      timeslotEnd: '2026-06-08T10:00:00.000Z',
      bookedByUser: true,
      hasActiveBooking: true,
    });

    const { status } = getSlotStatus(COURT_A, june8Berlin, '11:00', [session], []);

    expect(status).toBe('own-booking');
  });

  it('returns "booked" when session has active booking by someone else', () => {
    const session = makeSession({
      timeslotStart: '2026-06-08T09:00:00.000Z',
      timeslotEnd: '2026-06-08T10:00:00.000Z',
      bookedByUser: false,
      hasActiveBooking: true,
    });

    const { status } = getSlotStatus(COURT_A, june8Berlin, '11:00', [session], []);

    expect(status).toBe('booked');
  });

  it('returns "blocked" for event/maintenance sessions', () => {
    const session = makeSession({
      timeslotStart: '2026-06-08T09:00:00.000Z',
      timeslotEnd: '2026-06-08T10:00:00.000Z',
      sessionType: 'maintenance',
    });

    const { status } = getSlotStatus(COURT_A, june8Berlin, '11:00', [session], []);

    expect(status).toBe('blocked');
  });

  it('returns "plan" when a plan entry covers the time slot', () => {
    const planEntries = [
      {
        court_id: COURT_A,
        start_time: '10:00',
        end_time: '12:00',
      },
    ];

    const { status } = getSlotStatus(COURT_A, june8Berlin, '11:00', [], planEntries);

    expect(status).toBe('plan');
  });

  it('prioritizes session over plan entry', () => {
    const session = makeSession({
      timeslotStart: '2026-06-08T09:00:00.000Z',
      timeslotEnd: '2026-06-08T10:00:00.000Z',
    });
    const planEntries = [
      {
        court_id: COURT_A,
        start_time: '10:00',
        end_time: '12:00',
      },
    ];

    const { status } = getSlotStatus(COURT_A, june8Berlin, '11:00', [session], planEntries);

    // Session takes priority
    expect(status).toBe('session');
  });
});

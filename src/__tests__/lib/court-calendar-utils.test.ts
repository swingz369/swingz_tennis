import { describe, it, expect } from 'vitest';
import {
  getSessionForSlot,
  getSlotStatus,
  SLOT_STATUS_STYLES,
  SLOT_STATUS_STYLES_ADMIN_BLOCKED,
  DAILY_BLOCK_STYLES,
  getCalendarLegendItems,
  type SlotStatus,
} from '@/lib/court-calendar-utils';
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
  } as Session;
}

const june8Berlin = new Date('2026-06-08T00:00:00+02:00'); // local midnight Berlin

/* ── getSessionForSlot ── */

describe('getSessionForSlot', () => {
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

  it('matches correctly with overlapping time slots (session 11:00–12:00, slot 11:00)', () => {
    // getSessionForSlot constructs slotEnd = slotStart + 1h, so a "11:00" timeSlot
    // covers 11:00–12:00 which overlaps the session exactly.
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

/* ── getSlotStatus ── */

describe('getSlotStatus', () => {
  it('returns "available" when no session or plan matches', () => {
    const result = getSlotStatus(COURT_A, june8Berlin, '11:00', [], []);
    expect(result.status).toBe('available');
    expect(result.session).toBeUndefined();
  });

  it('returns "blocked" with closedDay flag for a closed weekday', () => {
    // 2026-06-08 is a Monday (getDay() === 1).
    const openingHours = { monday: { open: '08:00', close: '22:00', closed: true } };
    const result = getSlotStatus(COURT_A, june8Berlin, '11:00', [], [], [], openingHours);
    expect(result.status).toBe('blocked');
    expect(result.closedDay).toBe(true);
  });

  it('keeps "available" when openingHours is empty/legacy (no closed flag)', () => {
    const result = getSlotStatus(COURT_A, june8Berlin, '11:00', [], [], [], {});
    expect(result.status).toBe('available');
    expect(result.closedDay).toBeUndefined();
  });

  it('returns "session" for a training session with no booking', () => {
    const s = makeSession({ bookedByUser: false, hasActiveBooking: false });
    const result = getSlotStatus(COURT_A, june8Berlin, '11:00', [s], []);
    expect(result.status).toBe('session');
    expect(result.session).toBe(s);
  });

  it('returns "own-booking" when bookedByUser is true', () => {
    const s = makeSession({ bookedByUser: true, hasActiveBooking: true });
    const result = getSlotStatus(COURT_A, june8Berlin, '11:00', [s], []);
    expect(result.status).toBe('own-booking');
    expect(result.session).toBe(s);
  });

  it('returns "booked" when someone else has an active booking', () => {
    const s = makeSession({ bookedByUser: false, hasActiveBooking: true });
    const result = getSlotStatus(COURT_A, june8Berlin, '11:00', [s], []);
    expect(result.status).toBe('booked');
    expect(result.session).toBe(s);
  });

  it('returns "blocked" for event sessions', () => {
    const s = makeSession({ sessionType: 'event' });
    const result = getSlotStatus(COURT_A, june8Berlin, '11:00', [s], []);
    expect(result.status).toBe('blocked');
    expect(result.session).toBe(s);
  });

  it('returns "blocked" for maintenance sessions', () => {
    const s = makeSession({ sessionType: 'maintenance' });
    const result = getSlotStatus(COURT_A, june8Berlin, '11:00', [s], []);
    expect(result.status).toBe('blocked');
    expect(result.session).toBe(s);
  });

  it('blocked takes priority over bookedByUser', () => {
    const s = makeSession({
      sessionType: 'event',
      bookedByUser: true,
      hasActiveBooking: true,
    });
    const result = getSlotStatus(COURT_A, june8Berlin, '11:00', [s], []);
    expect(result.status).toBe('blocked');
  });

  it('returns "plan" when a plan entry covers the slot', () => {
    const planEntries = [{ court_id: COURT_A, start_time: '10:00', end_time: '12:00' }];
    const result = getSlotStatus(COURT_A, june8Berlin, '11:00', [], planEntries);
    expect(result.status).toBe('plan');
  });

  it('session takes priority over plan', () => {
    const s = makeSession({ bookedByUser: false, hasActiveBooking: false });
    const planEntries = [{ court_id: COURT_A, start_time: '10:00', end_time: '12:00' }];
    const result = getSlotStatus(COURT_A, june8Berlin, '11:00', [s], planEntries);
    expect(result.status).toBe('session');
  });

  it('ignores sessions on different courts', () => {
    const s = makeSession({ courtId: COURT_B });
    const result = getSlotStatus(COURT_A, june8Berlin, '11:00', [s], []);
    expect(result.status).toBe('available');
  });

  it('ignores plan entries on different courts', () => {
    const planEntries = [{ court_id: COURT_B, start_time: '10:00', end_time: '12:00' }];
    const result = getSlotStatus(COURT_A, june8Berlin, '11:00', [], planEntries);
    expect(result.status).toBe('available');
  });
});

/* ── SLOT_STATUS_STYLES ── */

describe('SLOT_STATUS_STYLES', () => {
  const allStatuses: SlotStatus[] = [
    'available',
    'session',
    'booked',
    'own-booking',
    'plan',
    'blocked',
  ];

  it.each(allStatuses)('has a non-empty className for "%s"', (status: SlotStatus) => {
    expect(SLOT_STATUS_STYLES[status]).toBeTruthy();
    expect(typeof SLOT_STATUS_STYLES[status]).toBe('string');
    expect(SLOT_STATUS_STYLES[status].length).toBeGreaterThan(0);
  });

  it('available uses success palette', () => {
    expect(SLOT_STATUS_STYLES.available).toContain('success');
  });

  it('session uses info palette', () => {
    expect(SLOT_STATUS_STYLES.session).toContain('info');
  });

  it('booked uses warning palette', () => {
    expect(SLOT_STATUS_STYLES.booked).toContain('warning');
  });

  it('own-booking uses error palette', () => {
    expect(SLOT_STATUS_STYLES['own-booking']).toContain('error');
  });

  it('plan uses info palette', () => {
    expect(SLOT_STATUS_STYLES.plan).toContain('info');
  });

  it('blocked uses gray palette', () => {
    expect(SLOT_STATUS_STYLES.blocked).toContain('gray');
  });

  it('admin blocked override includes cursor-pointer', () => {
    expect(SLOT_STATUS_STYLES_ADMIN_BLOCKED).toContain('cursor-pointer');
  });

  it('admin blocked override includes hover styles', () => {
    expect(SLOT_STATUS_STYLES_ADMIN_BLOCKED).toContain('hover:');
  });
});

/* ── DAILY_BLOCK_STYLES ── */

describe('DAILY_BLOCK_STYLES', () => {
  const keys = ['available', 'session', 'booked', 'own-booking', 'blocked'] as const;

  it.each(keys)('has bg, text, and accent for "%s"', (key: (typeof keys)[number]) => {
    const style = DAILY_BLOCK_STYLES[key];
    expect(style.bg).toBeTruthy();
    expect(style.text).toBeTruthy();
    expect(style.accent).toBeTruthy();
  });

  it('available uses success palette (matching SLOT_STATUS_STYLES)', () => {
    expect(DAILY_BLOCK_STYLES.available.bg).toContain('success');
  });

  it('booked uses warning palette', () => {
    expect(DAILY_BLOCK_STYLES.booked.bg).toContain('warning');
  });

  it('own-booking uses error palette', () => {
    expect(DAILY_BLOCK_STYLES['own-booking'].bg).toContain('error');
  });

  it('blocked uses gray palette', () => {
    expect(DAILY_BLOCK_STYLES.blocked.bg).toContain('gray');
  });
});

/* ── getCalendarLegendItems ── */

describe('getCalendarLegendItems', () => {
  it('returns 4 items for admin', () => {
    const items = getCalendarLegendItems(true);
    expect(items).toHaveLength(4);
    expect(items.map((i) => i.label)).toContain('Session (Drag & Drop)');
    expect(items.map((i) => i.label)).toContain('Gesperrt');
  });

  it('returns 5 items for non-admin (member)', () => {
    const items = getCalendarLegendItems(false);
    expect(items).toHaveLength(5);
    expect(items.map((i) => i.label)).toContain('Belegt (gebucht)');
    expect(items.map((i) => i.label)).toContain('Deine Buchung');
  });

  it('always includes Verfügbar and Gruppentraining', () => {
    const admin = getCalendarLegendItems(true);
    const member = getCalendarLegendItems(false);
    expect(admin[0].label).toBe('Verfügbar');
    expect(admin[1].label).toBe('Gruppentraining');
    expect(member[0].label).toBe('Verfügbar');
    expect(member[1].label).toBe('Gruppentraining');
  });

  it('dot colors match SLOT_STATUS_STYLES palette', () => {
    const admin = getCalendarLegendItems(true);
    expect(admin[0].className).toContain('success'); // Verfügbar
    expect(admin[1].className).toContain('info'); // Gruppentraining
    expect(admin[2].className).toContain('info'); // Session
    expect(admin[3].className).toContain('gray'); // Gesperrt
  });
});

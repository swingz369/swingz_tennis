import { describe, it, expect } from 'vitest';
import {
  getSlotStatus,
  SLOT_STATUS_STYLES,
  SLOT_STATUS_STYLES_ADMIN_BLOCKED,
  DAILY_BLOCK_STYLES,
  getCalendarLegendItems,
  type SlotStatus,
} from '../../lib/court-calendar-utils';

/** Helper to build a Date at a specific hour on a known day */
function makeDate(hour: number, day = 15): Date {
  return new Date(2026, 5, day, hour, 0, 0); // June 2026
}

const DATE = makeDate(0); // base date for slot lookups

/** Minimal session mock matching the Session type shape used by getSlotStatus */
function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    courtId: 'court-1',
    courtName: 'Platz 1',
    timeslotStart: makeDate(10).toISOString(),
    timeslotEnd: makeDate(12).toISOString(),
    startTime: '10:00',
    endTime: '12:00',
    dayOfWeek: 1,
    trainerId: 't1',
    trainerName: 'Max',
    sessionType: 'training' as const,
    bookedByUser: false,
    hasActiveBooking: false,
    maxParticipants: 8,
    notes: '',
    groupIds: [],
    ...overrides,
  };
}

describe('getSlotStatus', () => {
  it('returns "available" when no session or plan matches', () => {
    const result = getSlotStatus('court-1', DATE, '08:00', [], []);
    expect(result.status).toBe('available');
    expect(result.session).toBeUndefined();
  });

  it('returns "session" for a training session with no booking', () => {
    const s = session({
      timeslotStart: makeDate(10).toISOString(),
      timeslotEnd: makeDate(11).toISOString(),
    });
    const result = getSlotStatus('court-1', DATE, '10:00', [s], []);
    expect(result.status).toBe('session');
    expect(result.session).toBe(s);
  });

  it('returns "own-booking" when bookedByUser is true', () => {
    const s = session({
      bookedByUser: true,
      hasActiveBooking: true,
      timeslotStart: makeDate(10).toISOString(),
      timeslotEnd: makeDate(11).toISOString(),
    });
    const result = getSlotStatus('court-1', DATE, '10:00', [s], []);
    expect(result.status).toBe('own-booking');
    expect(result.session).toBe(s);
  });

  it('returns "booked" when someone else has an active booking', () => {
    const s = session({
      bookedByUser: false,
      hasActiveBooking: true,
      timeslotStart: makeDate(10).toISOString(),
      timeslotEnd: makeDate(11).toISOString(),
    });
    const result = getSlotStatus('court-1', DATE, '10:00', [s], []);
    expect(result.status).toBe('booked');
    expect(result.session).toBe(s);
  });

  it('returns "blocked" for event sessions', () => {
    const s = session({
      sessionType: 'event',
      timeslotStart: makeDate(10).toISOString(),
      timeslotEnd: makeDate(11).toISOString(),
    });
    const result = getSlotStatus('court-1', DATE, '10:00', [s], []);
    expect(result.status).toBe('blocked');
    expect(result.session).toBe(s);
  });

  it('returns "blocked" for maintenance sessions', () => {
    const s = session({
      sessionType: 'maintenance',
      timeslotStart: makeDate(10).toISOString(),
      timeslotEnd: makeDate(11).toISOString(),
    });
    const result = getSlotStatus('court-1', DATE, '10:00', [s], []);
    expect(result.status).toBe('blocked');
    expect(result.session).toBe(s);
  });

  it('blocked takes priority over bookedByUser', () => {
    const s = session({
      sessionType: 'event',
      bookedByUser: true,
      hasActiveBooking: true,
      timeslotStart: makeDate(10).toISOString(),
      timeslotEnd: makeDate(11).toISOString(),
    });
    const result = getSlotStatus('court-1', DATE, '10:00', [s], []);
    expect(result.status).toBe('blocked');
  });

  it('returns "plan" when a plan entry covers the slot', () => {
    const planEntries = [{ court_id: 'court-1', start_time: '09:00', end_time: '11:00' }];
    const result = getSlotStatus('court-1', DATE, '10:00', [], planEntries);
    expect(result.status).toBe('plan');
  });

  it('session takes priority over plan', () => {
    const s = session({
      timeslotStart: makeDate(10).toISOString(),
      timeslotEnd: makeDate(11).toISOString(),
    });
    const planEntries = [{ court_id: 'court-1', start_time: '09:00', end_time: '11:00' }];
    const result = getSlotStatus('court-1', DATE, '10:00', [s], planEntries);
    expect(result.status).toBe('session');
  });

  it('ignores sessions on different courts', () => {
    const s = session({
      courtId: 'court-2',
      timeslotStart: makeDate(10).toISOString(),
      timeslotEnd: makeDate(11).toISOString(),
    });
    const result = getSlotStatus('court-1', DATE, '10:00', [s], []);
    expect(result.status).toBe('available');
  });

  it('ignores plan entries on different courts', () => {
    const planEntries = [{ court_id: 'court-2', start_time: '09:00', end_time: '11:00' }];
    const result = getSlotStatus('court-1', DATE, '10:00', [], planEntries);
    expect(result.status).toBe('available');
  });
});

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

  it('available uses emerald palette', () => {
    expect(SLOT_STATUS_STYLES.available).toContain('emerald');
  });

  it('session uses blue palette', () => {
    expect(SLOT_STATUS_STYLES.session).toContain('blue');
  });

  it('booked uses amber palette', () => {
    expect(SLOT_STATUS_STYLES.booked).toContain('amber');
  });

  it('own-booking uses rose palette', () => {
    expect(SLOT_STATUS_STYLES['own-booking']).toContain('rose');
  });

  it('plan uses violet palette', () => {
    expect(SLOT_STATUS_STYLES.plan).toContain('violet');
  });

  it('blocked uses zinc palette', () => {
    expect(SLOT_STATUS_STYLES.blocked).toContain('zinc');
  });

  it('admin blocked override includes cursor-pointer', () => {
    expect(SLOT_STATUS_STYLES_ADMIN_BLOCKED).toContain('cursor-pointer');
  });

  it('admin blocked override includes hover styles', () => {
    expect(SLOT_STATUS_STYLES_ADMIN_BLOCKED).toContain('hover:');
  });
});

describe('DAILY_BLOCK_STYLES', () => {
  const keys = ['available', 'session', 'booked', 'own-booking', 'blocked'] as const;

  it.each(keys)('has bg, text, and accent for "%s"', (key: (typeof keys)[number]) => {
    const style = DAILY_BLOCK_STYLES[key];
    expect(style.bg).toBeTruthy();
    expect(style.text).toBeTruthy();
    expect(style.accent).toBeTruthy();
  });

  it('available uses emerald palette (matching SLOT_STATUS_STYLES)', () => {
    expect(DAILY_BLOCK_STYLES.available.bg).toContain('emerald');
  });

  it('booked uses amber palette', () => {
    expect(DAILY_BLOCK_STYLES.booked.bg).toContain('amber');
  });

  it('own-booking uses rose palette', () => {
    expect(DAILY_BLOCK_STYLES['own-booking'].bg).toContain('rose');
  });

  it('blocked uses zinc palette', () => {
    expect(DAILY_BLOCK_STYLES.blocked.bg).toContain('zinc');
  });
});

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
    expect(admin[0].className).toContain('emerald'); // Verfügbar
    expect(admin[1].className).toContain('violet'); // Gruppentraining
    expect(admin[2].className).toContain('blue'); // Session
    expect(admin[3].className).toContain('zinc'); // Gesperrt
  });
});

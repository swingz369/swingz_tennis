import { describe, it, expect } from 'vitest';
import { isDayClosed, CLOSED_DAY_ERROR } from '@/lib/booking/opening-hours';

/* Mittagszeiten, damit getDay() unabhängig von der Laufzeit-Zeitzone stimmt.
 * 2026-06-08 = Montag, 2026-06-14 = Sonntag. */
const monday = new Date(2026, 5, 8, 12);
const sunday = new Date(2026, 5, 14, 12);

describe('isDayClosed', () => {
  it('returns false for empty/absent opening hours', () => {
    expect(isDayClosed(null, monday)).toBe(false);
    expect(isDayClosed(undefined, monday)).toBe(false);
    expect(isDayClosed({}, monday)).toBe(false);
  });

  it('returns false when the day has no closed flag (legacy format)', () => {
    const legacy = { monday: { open: '09:00', close: '22:00' } };
    expect(isDayClosed(legacy, monday)).toBe(false);
  });

  it('returns false for the old registration format { mo: "07:00-22:00" }', () => {
    const old = { mo: '07:00-22:00', di: '07:00-22:00' };
    expect(isDayClosed(old, monday)).toBe(false);
  });

  it('returns true when the matching weekday has closed === true', () => {
    const hours = {
      monday: { open: '09:00', close: '22:00', closed: true },
      sunday: { open: '09:00', close: '22:00', closed: false },
    };
    expect(isDayClosed(hours, monday)).toBe(true);
    expect(isDayClosed(hours, sunday)).toBe(false);
  });

  it('maps the correct weekday (Sunday = getDay() 0)', () => {
    const hours = {
      sunday: { open: '09:00', close: '22:00', closed: true },
    };
    expect(isDayClosed(hours, sunday)).toBe(true);
    expect(isDayClosed(hours, monday)).toBe(false);
  });

  it('treats closed !== true (e.g. missing or false) as open', () => {
    const hours = { monday: { open: '09:00', close: '22:00', closed: false } };
    expect(isDayClosed(hours, monday)).toBe(false);
  });
});

describe('CLOSED_DAY_ERROR', () => {
  it('is a readable German message', () => {
    expect(CLOSED_DAY_ERROR).toContain('geschlossen');
  });
});

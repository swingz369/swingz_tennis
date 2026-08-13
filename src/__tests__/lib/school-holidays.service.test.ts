import { describe, it, expect } from 'vitest';
import { isSessionInHoliday } from '@/lib/services/school-holidays.service';

const bayernSommer = [{ name: 'Sommerferien', start_date: '2026-07-27', end_date: '2026-09-07' }];

describe('isSessionInHoliday', () => {
  it('returns true when session is within holiday range', () => {
    expect(isSessionInHoliday(new Date('2026-08-15'), bayernSommer)).toBe(true);
  });
  it('returns false when session is outside all holidays', () => {
    expect(isSessionInHoliday(new Date('2026-06-01'), bayernSommer)).toBe(false);
  });
  it('returns true on boundary start date', () => {
    expect(isSessionInHoliday(new Date('2026-07-27'), bayernSommer)).toBe(true);
  });
  it('returns true on boundary end date', () => {
    expect(isSessionInHoliday(new Date('2026-09-07'), bayernSommer)).toBe(true);
  });
  it('returns false the day after holiday ends', () => {
    expect(isSessionInHoliday(new Date('2026-09-08'), bayernSommer)).toBe(false);
  });
});

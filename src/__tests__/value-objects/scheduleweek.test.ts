import { describe, it, expect } from 'vitest';
import { ScheduleWeek } from '@/domain/value-objects/timeslot';

describe('ScheduleWeek', () => {
  describe('fromDate', () => {
    it('should create ScheduleWeek from a date', () => {
      const date = new Date(2024, 0, 15);
      const week = ScheduleWeek.fromDate(date);

      expect(week.getYear()).toBe(2024);
      expect(week.getWeekNumber()).toBeGreaterThan(0);
      expect(week.getWeekNumber()).toBeLessThanOrEqual(53);
    });
  });

  describe('current', () => {
    it('should return current week', () => {
      const week = ScheduleWeek.current();
      const now = new Date();

      expect(week.getYear()).toBe(now.getFullYear());
      expect(week.contains(now)).toBe(true);
    });
  });

  describe('contains', () => {
    it('should correctly identify dates within the week', () => {
      const week = new ScheduleWeek(2024, 2);
      const monday = week.getMonday();
      const wednesday = new Date(monday);
      wednesday.setDate(wednesday.getDate() + 2);
      const sunday = week.getSunday();
      const nextMonday = new Date(sunday);
      nextMonday.setDate(nextMonday.getDate() + 1);

      expect(week.contains(monday)).toBe(true);
      expect(week.contains(wednesday)).toBe(true);
      expect(week.contains(sunday)).toBe(true);
      expect(week.contains(nextMonday)).toBe(false);
    });
  });

  describe('next and previous', () => {
    it('should navigate weeks correctly', () => {
      const week = new ScheduleWeek(2024, 10);
      const next = week.next();
      const prev = week.previous();

      expect(next.getWeekNumber()).toBe(11);
      expect(prev.getWeekNumber()).toBe(9);
    });

    it('should handle year boundary', () => {
      const week = new ScheduleWeek(2024, 1);
      const prev = week.previous();
      expect(prev.getYear()).toBe(2023);
      expect(prev.getWeekNumber()).toBe(52);
    });
  });

  describe('equals', () => {
    it('should compare weeks correctly', () => {
      const week1 = new ScheduleWeek(2024, 10);
      const week2 = new ScheduleWeek(2024, 10);
      const week3 = new ScheduleWeek(2024, 11);

      expect(week1.equals(week2)).toBe(true);
      expect(week1.equals(week3)).toBe(false);
    });
  });
});

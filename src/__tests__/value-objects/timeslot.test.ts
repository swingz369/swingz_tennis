import { describe, it, expect } from 'vitest';
import { TimeSlot } from '@/domain/value-objects/timeslot';

describe('TimeSlot', () => {
  describe('constructor', () => {
    it('should create a valid time slot', () => {
      const start = new Date(2024, 0, 1, 10, 0);
      const end = new Date(2024, 0, 1, 11, 0);
      const slot = new TimeSlot(start, end);

      expect(slot.getStart()).toEqual(start);
      expect(slot.getEnd()).toEqual(end);
      expect(slot.getDurationMinutes()).toBe(60);
    });

    it('should throw if start is after end', () => {
      const start = new Date(2024, 0, 1, 11, 0);
      const end = new Date(2024, 0, 1, 10, 0);

      expect(() => new TimeSlot(start, end)).toThrow('Start time must be before end time');
    });

    it('should throw if start equals end', () => {
      const date = new Date(2024, 0, 1, 10, 0);
      expect(() => new TimeSlot(date, date)).toThrow('Start time must be before end time');
    });

    it('should throw if duration exceeds 8 hours', () => {
      const start = new Date(2024, 0, 1, 8, 0);
      const end = new Date(2024, 0, 1, 17, 1);
      expect(() => new TimeSlot(start, end)).toThrow(
        'TimeSlot duration must be between 1 minute and 8 hours'
      );
    });
  });

  describe('overlaps', () => {
    it('should detect overlapping slots', () => {
      const slot1 = new TimeSlot(new Date(2024, 0, 1, 10, 0), new Date(2024, 0, 1, 11, 0));
      const slot2 = new TimeSlot(new Date(2024, 0, 1, 10, 30), new Date(2024, 0, 1, 11, 30));
      const slot3 = new TimeSlot(new Date(2024, 0, 1, 11, 0), new Date(2024, 0, 1, 12, 0));

      expect(slot1.overlaps(slot2)).toBe(true);
      expect(slot2.overlaps(slot1)).toBe(true);
      expect(slot1.overlaps(slot3)).toBe(false);
    });
  });

  describe('toString and fromString', () => {
    it('should serialize and deserialize correctly', () => {
      const start = new Date(2024, 0, 1, 10, 0);
      const end = new Date(2024, 0, 1, 11, 0);
      const slot = new TimeSlot(start, end);

      const str = slot.toString();
      const parsed = TimeSlot.fromString(str);

      expect(parsed.getStart()).toEqual(start);
      expect(parsed.getEnd()).toEqual(end);
    });
  });
});

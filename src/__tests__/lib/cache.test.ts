import { describe, it, expect } from 'vitest';
import { QUERY_KEYS, CACHE_TIMES, STALE_TIMES } from '@/lib/cache';

describe('Cache Configuration', () => {
  describe('QUERY_KEYS', () => {
    it('should have user-related keys', () => {
      expect(QUERY_KEYS).toHaveProperty('userClub');
      expect(QUERY_KEYS).toHaveProperty('userMember');
      expect(QUERY_KEYS).toHaveProperty('userRoles');
    });

    it('should have booking-related keys', () => {
      expect(QUERY_KEYS).toHaveProperty('bookings');
    });

    it('should have schedule-related keys', () => {
      expect(QUERY_KEYS).toHaveProperty('schedule');
    });

    it('should have court-related keys', () => {
      expect(QUERY_KEYS).toHaveProperty('courts');
      expect(QUERY_KEYS).toHaveProperty('sessions');
    });

    it('should have trainer-related keys', () => {
      expect(QUERY_KEYS).toHaveProperty('trainers');
    });

    it('should have billing and notification keys', () => {
      expect(QUERY_KEYS).toHaveProperty('invoices');
      expect(QUERY_KEYS).toHaveProperty('members');
      expect(QUERY_KEYS).toHaveProperty('notifications');
    });
  });

  describe('CACHE_TIMES', () => {
    it('should have defined cache times', () => {
      expect(CACHE_TIMES).toHaveProperty('IMMEDIATE');
      expect(CACHE_TIMES).toHaveProperty('SHORT');
      expect(CACHE_TIMES).toHaveProperty('MEDIUM');
      expect(CACHE_TIMES).toHaveProperty('LONG');
      expect(CACHE_TIMES).toHaveProperty('VERY_LONG');
      expect(CACHE_TIMES).toHaveProperty('DAY');
    });

    it('should have reasonable cache time values', () => {
      expect(CACHE_TIMES.IMMEDIATE).toBe(0);
      expect(CACHE_TIMES.SHORT).toBeGreaterThan(0);
      expect(CACHE_TIMES.MEDIUM).toBeGreaterThan(CACHE_TIMES.SHORT);
      expect(CACHE_TIMES.LONG).toBeGreaterThan(CACHE_TIMES.MEDIUM);
      expect(CACHE_TIMES.VERY_LONG).toBeGreaterThan(CACHE_TIMES.LONG);
      expect(CACHE_TIMES.DAY).toBeGreaterThan(CACHE_TIMES.VERY_LONG);
    });
  });

  describe('STALE_TIMES', () => {
    it('should have defined stale times', () => {
      expect(STALE_TIMES).toHaveProperty('IMMEDIATE');
      expect(STALE_TIMES).toHaveProperty('SHORT');
      expect(STALE_TIMES).toHaveProperty('MEDIUM');
      expect(STALE_TIMES).toHaveProperty('LONG');
      expect(STALE_TIMES).toHaveProperty('VERY_LONG');
    });

    it('should have reasonable stale time values', () => {
      expect(STALE_TIMES.IMMEDIATE).toBe(0);
      expect(STALE_TIMES.SHORT).toBeGreaterThan(0);
      expect(STALE_TIMES.MEDIUM).toBeGreaterThan(STALE_TIMES.SHORT);
      expect(STALE_TIMES.LONG).toBeGreaterThan(STALE_TIMES.MEDIUM);
      expect(STALE_TIMES.VERY_LONG).toBeGreaterThan(STALE_TIMES.LONG);
    });
  });

  describe('Cache Time Relationships', () => {
    it('should have gcTime greater than or equal to staleTime', () => {
      expect(CACHE_TIMES.SHORT).toBeGreaterThanOrEqual(STALE_TIMES.SHORT);
      expect(CACHE_TIMES.MEDIUM).toBeGreaterThanOrEqual(STALE_TIMES.MEDIUM);
      expect(CACHE_TIMES.LONG).toBeGreaterThanOrEqual(STALE_TIMES.LONG);
    });
  });
});

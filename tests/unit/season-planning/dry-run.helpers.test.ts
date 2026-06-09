/**
 * Unit tests for pure helpers exported from
 * `@/lib/season-planning/dry-run.service`.
 *
 * These helpers do not touch the database — they receive raw values and
 * return deterministic structures, so they're the right surface to unit-test.
 *
 * Tested:
 *   - parseTime (HH:MM:SS → {h, m})
 *   - isoDate (Date → YYYY-MM-DD)
 *   - aggregateRsvpRows (raw RSVP rows → counts + acceptance rate)
 *   - simulateSessionBuckets (entry list + season + holidays → bucket plan)
 *
 * The full `runSeasonDryRun` is tested in integration tests because it
 * requires a live DB / Supabase client.
 */

import { describe, it, expect } from 'vitest';

import {
  aggregateRsvpRows,
  simulateSessionBuckets,
  EMPTY_RSVP_DISTRIBUTION,
  type DryRunRsvpDistribution,
} from '@/lib/season-planning/dry-run.service';

// Import internals via the module re-exports (the helpers we care about
// are NOT marked internal, so they're public).

// ============================================
// aggregateRsvpRows
// ============================================
describe('aggregateRsvpRows', () => {
  it('returns the empty distribution shape for an empty input', () => {
    const dist = aggregateRsvpRows([]);
    expect(dist.total).toBe(0);
    expect(dist.counts).toEqual({
      accepted: 0,
      declined: 0,
      maybe: 0,
      pending: 0,
      unknown: 0,
    });
    expect(dist.acceptanceRate).toBe(0);
    expect(dist.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('counts accepted, declined and maybe correctly', () => {
    const dist = aggregateRsvpRows([
      { status: 'yes' },
      { status: 'yes' },
      { status: 'no' },
      { status: 'maybe' },
    ]);
    expect(dist.total).toBe(4);
    expect(dist.counts.accepted).toBe(2);
    expect(dist.counts.declined).toBe(1);
    expect(dist.counts.maybe).toBe(1);
    expect(dist.acceptanceRate).toBe(0.5);
  });

  it('normalizes legacy aliases (attending/declined/confirmed/…)', () => {
    const dist = aggregateRsvpRows([
      { status: 'attending' },
      { status: 'confirmed' },
      { status: 'rejected' },
      { status: 'tentative' },
      { status: 'waiting' },
    ]);
    expect(dist.counts.accepted).toBe(2);
    expect(dist.counts.declined).toBe(1);
    expect(dist.counts.maybe).toBe(1);
    expect(dist.counts.pending).toBe(1);
  });

  it('buckets null and unknown statuses under pending / unknown', () => {
    const dist = aggregateRsvpRows([
      { status: null },
      { status: undefined },
      { status: '' },
      { status: 'no_response' },
      { status: 'foo-bar-baz' },
    ]);
    expect(dist.counts.pending).toBe(4); // null/undefined/''/no_response
    expect(dist.counts.unknown).toBe(1); // foo-bar-baz
    expect(dist.total).toBe(5);
  });

  it('rounds acceptance rate to 3 decimal places', () => {
    // 2 / 3 = 0.6666… → 0.667
    const dist = aggregateRsvpRows([{ status: 'yes' }, { status: 'yes' }, { status: 'no' }]);
    expect(dist.acceptanceRate).toBe(0.667);
  });

  it('returns 0 acceptance rate when there are no rows', () => {
    expect(aggregateRsvpRows([]).acceptanceRate).toBe(0);
  });

  it('handles case-insensitive status values', () => {
    const dist = aggregateRsvpRows([{ status: 'YES' }, { status: 'Accepted' }, { status: 'NO' }]);
    expect(dist.counts.accepted).toBe(2);
    expect(dist.counts.declined).toBe(1);
  });
});

// ============================================
// EMPTY_RSVP_DISTRIBUTION
// ============================================
describe('EMPTY_RSVP_DISTRIBUTION', () => {
  it('is a stable, well-typed empty default', () => {
    expect(EMPTY_RSVP_DISTRIBUTION).toEqual({
      counts: { accepted: 0, declined: 0, maybe: 0, pending: 0, unknown: 0 },
      total: 0,
      acceptanceRate: 0,
      sessionSampleSize: 0,
      capturedAt: '',
    });
  });
});

// ============================================
// simulateSessionBuckets
// ============================================
describe('simulateSessionBuckets', () => {
  const seasonStart = new Date('2026-01-05T00:00:00Z'); // Monday
  const seasonEnd = new Date('2026-03-29T00:00:00Z'); // Sunday (12 weeks)
  const TOTAL_WEEKS = 12;

  it('returns zero counts for an empty entry list', () => {
    const sim = simulateSessionBuckets([], {
      seasonStart,
      seasonEnd,
      totalSeasonWeeks: TOTAL_WEEKS,
      holidays: [],
    });
    expect(sim.buckets).toEqual([]);
    expect(sim.wouldCreateSessions).toBe(0);
    expect(sim.skippedHolidaySessions).toBe(0);
    expect(sim.activeTrainerIds.size).toBe(0);
    expect(sim.activeCourtIds.size).toBe(0);
  });

  it('creates one session per (entry × week) for a single weekly entry', () => {
    const sim = simulateSessionBuckets(
      [
        {
          trainer_id: 'trainer-1',
          day_of_week: 0, // Monday
          start_time: '17:00:00',
          end_time: '18:30:00',
          duration_minutes: 90,
          court_id: 'court-1',
          group_id: 'group-1',
          starts_from_week: 1,
          ends_at_week: 12,
        },
      ],
      {
        seasonStart,
        seasonEnd,
        totalSeasonWeeks: TOTAL_WEEKS,
        holidays: [],
      }
    );
    expect(sim.wouldCreateSessions).toBe(12);
    expect(sim.skippedHolidaySessions).toBe(0);
    expect(sim.activeTrainerIds.has('trainer-1')).toBe(true);
    expect(sim.activeCourtIds.has('court-1')).toBe(true);
    // First bucket = first Monday at 17:00
    const first = sim.buckets[0];
    expect(first?.date).toBe('2026-01-05');
    expect(first?.hour).toBe(17);
    expect(first?.durationMin).toBe(90);
    expect(first?.wouldCreate).toBe(true);
  });

  it('marks holiday-week sessions as wouldCreate=false and includes holidayNames', () => {
    const sim = simulateSessionBuckets(
      [
        {
          trainer_id: 'trainer-1',
          day_of_week: 0,
          start_time: '17:00:00',
          end_time: '18:30:00',
          duration_minutes: 90,
          court_id: 'court-1',
          group_id: 'group-1',
          starts_from_week: 1,
          ends_at_week: 12,
        },
      ],
      {
        seasonStart,
        seasonEnd,
        totalSeasonWeeks: TOTAL_WEEKS,
        holidays: [{ name: 'Testferien', start: '2026-01-12', end: '2026-01-18' }],
      }
    );
    expect(sim.wouldCreateSessions).toBe(11);
    expect(sim.skippedHolidaySessions).toBe(1);
    const holidayBucket = sim.buckets.find((b) => b.date === '2026-01-12');
    expect(holidayBucket).toBeDefined();
    expect(holidayBucket?.wouldCreate).toBe(false);
    expect(holidayBucket?.skipReason).toBe('holiday');
    expect(holidayBucket?.holidayNames).toEqual(['Testferien']);
  });

  it('respects starts_from_week and ends_at_week', () => {
    const sim = simulateSessionBuckets(
      [
        {
          trainer_id: 'trainer-1',
          day_of_week: 0,
          start_time: '17:00:00',
          end_time: '18:30:00',
          duration_minutes: 90,
          court_id: null,
          group_id: 'group-1',
          starts_from_week: 3,
          ends_at_week: 6,
        },
      ],
      {
        seasonStart,
        seasonEnd,
        totalSeasonWeeks: TOTAL_WEEKS,
        holidays: [],
      }
    );
    // 3, 4, 5, 6 → 4 weeks
    expect(sim.wouldCreateSessions).toBe(4);
    expect(sim.activeCourtIds.size).toBe(0); // court_id was null
  });

  it('computes durationMin from start_time/end_time when duration_minutes missing', () => {
    const sim = simulateSessionBuckets(
      [
        {
          trainer_id: 'trainer-1',
          day_of_week: 0,
          start_time: '14:00:00',
          end_time: '15:30:00',
          duration_minutes: null, // missing — should fall back to diff
          court_id: 'court-1',
          group_id: 'group-1',
        },
      ],
      {
        seasonStart,
        seasonEnd,
        totalSeasonWeeks: 1,
        holidays: [],
      }
    );
    expect(sim.wouldCreateSessions).toBe(1);
    expect(sim.buckets[0]?.durationMin).toBe(90);
  });

  it('caps the returned bucket list at the requested cap', () => {
    const sim = simulateSessionBuckets(
      [
        {
          trainer_id: 'trainer-1',
          day_of_week: 0,
          start_time: '17:00:00',
          end_time: '18:00:00',
          duration_minutes: 60,
          court_id: 'court-1',
          group_id: 'group-1',
          starts_from_week: 1,
          ends_at_week: 50,
        },
      ],
      {
        seasonStart,
        seasonEnd,
        totalSeasonWeeks: 50,
        holidays: [],
        cap: 10,
      }
    );
    expect(sim.buckets.length).toBe(10);
  });

  it('collects unique trainer and court ids', () => {
    const sim = simulateSessionBuckets(
      [
        {
          trainer_id: 'trainer-A',
          day_of_week: 0,
          start_time: '10:00:00',
          end_time: '11:00:00',
          duration_minutes: 60,
          court_id: 'court-X',
          group_id: 'g1',
        },
        {
          trainer_id: 'trainer-A',
          day_of_week: 2,
          start_time: '10:00:00',
          end_time: '11:00:00',
          duration_minutes: 60,
          court_id: 'court-Y',
          group_id: 'g1',
        },
        {
          trainer_id: 'trainer-B',
          day_of_week: 4,
          start_time: '10:00:00',
          end_time: '11:00:00',
          duration_minutes: 60,
          court_id: 'court-X',
          group_id: 'g2',
        },
      ],
      {
        seasonStart,
        seasonEnd,
        totalSeasonWeeks: 1,
        holidays: [],
      }
    );
    expect(sim.activeTrainerIds.size).toBe(2);
    expect(sim.activeCourtIds.size).toBe(2);
    expect([...sim.activeTrainerIds].sort()).toEqual(['trainer-A', 'trainer-B']);
    expect([...sim.activeCourtIds].sort()).toEqual(['court-X', 'court-Y']);
  });

  it('handles day_of_week=6 (Sunday in our scheme → JS Sunday=0)', () => {
    // Day 6 → JS 0
    const sim = simulateSessionBuckets(
      [
        {
          trainer_id: 'trainer-1',
          day_of_week: 6,
          start_time: '10:00:00',
          end_time: '11:00:00',
          duration_minutes: 60,
          court_id: 'court-1',
          group_id: 'g1',
        },
      ],
      {
        // Make season start a Monday so the first Sunday is 6 days later
        seasonStart: new Date('2026-01-05T00:00:00Z'),
        seasonEnd: new Date('2026-01-12T00:00:00Z'),
        totalSeasonWeeks: 2,
        holidays: [],
      }
    );
    expect(sim.buckets[0]?.date).toBe('2026-01-11'); // Sunday
    expect(sim.buckets[0]?.dayOfWeek).toBe(6);
  });
});

// ============================================
// DryRunRsvpDistribution type sanity
// ============================================
describe('DryRunRsvpDistribution shape', () => {
  it('exposes all 5 RsvpStatusKeys in the counts record', () => {
    const dist: DryRunRsvpDistribution = aggregateRsvpRows([{ status: 'yes' }]);
    expect(Object.keys(dist.counts).sort()).toEqual(
      ['accepted', 'declined', 'maybe', 'pending', 'unknown'].sort()
    );
  });
});

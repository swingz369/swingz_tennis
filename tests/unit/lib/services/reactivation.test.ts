/**
 * tests/unit/lib/services/reactivation.test.ts
 *
 * Sprint 4 Q2 — Ticket 2.5.2 (Inaktivitäts-Reaktivierung)
 *
 * Unit tests for the pure helpers + the runReactivation orchestration
 * (mocks createServiceClient and pushNotificationService via vi.mock).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock external modules (hoisted to top by vitest). The pure-helper tests
// don't touch these, so the mocks are harmless for them.
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}));

vi.mock('@/lib/push-notification.service', () => ({
  pushNotificationService: {
    sendToUser: vi.fn(),
  },
}));

import { createServiceClient } from '@/lib/supabase/service';
import { pushNotificationService, type PushPayload } from '@/lib/push-notification.service';
import {
  INACTIVITY_THRESHOLD_DAYS,
  REACTIVATION_COOLDOWN_DAYS,
  shouldReactivate,
  buildReactivationPayload,
  daysBetween,
  ReactivationService,
  type InactiveMember,
} from '@/lib/services/reactivation.service';

const NOW = new Date('2026-06-30T10:00:00.000Z');

/**
 * Build an InactiveMember fixture with sensible defaults. Pass overrides for the
 * specific field under test. shouldReactivate reads `daysSinceLastBooking`
 * directly (snapshot from findInactiveMembers).
 */
function makeMember(overrides: Partial<InactiveMember> = {}): InactiveMember {
  return {
    userId: 'user-1',
    clubId: 'club-1',
    fullName: 'Maria Schmidt',
    daysSinceLastBooking: 20,
    lastReactivationSentAt: null,
    reactivationCount: 0,
    ...overrides,
  };
}

describe('reactivation.service — constants', () => {
  it('inactivity threshold and cooldown are both 14 days (ticket spec)', () => {
    expect(INACTIVITY_THRESHOLD_DAYS).toBe(14);
    expect(REACTIVATION_COOLDOWN_DAYS).toBe(14);
  });
});

describe('reactivation.service — daysBetween', () => {
  it('returns null when from is null', () => {
    expect(daysBetween(null, NOW)).toBeNull();
  });

  it('returns full days between two timestamps', () => {
    const from = new Date(NOW.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
    expect(daysBetween(from, NOW)).toBe(20);
  });

  it('floors partial days (6.5 days → 6)', () => {
    const from = new Date(NOW.getTime() - 6.5 * 24 * 60 * 60 * 1000).toISOString();
    expect(daysBetween(from, NOW)).toBe(6);
  });
});

describe('reactivation.service — shouldReactivate', () => {
  it('returns true for a member with no recent booking and no recent push', () => {
    expect(shouldReactivate(makeMember(), NOW)).toBe(true);
  });

  it('returns false when daysSinceLastBooking is below threshold', () => {
    const member = makeMember({ daysSinceLastBooking: 10 });
    expect(shouldReactivate(member, NOW)).toBe(false);
  });

  it('returns false when last reactivation push is within cooldown', () => {
    const lastSent = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const member = makeMember({ lastReactivationSentAt: lastSent });
    expect(shouldReactivate(member, NOW)).toBe(false);
  });

  it('returns true when last reactivation push is past cooldown', () => {
    const lastSent = new Date(NOW.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
    const member = makeMember({ lastReactivationSentAt: lastSent });
    expect(shouldReactivate(member, NOW)).toBe(true);
  });

  it('boundary: exactly 14 days since last booking → eligible', () => {
    const member = makeMember({ daysSinceLastBooking: 14 });
    expect(shouldReactivate(member, NOW)).toBe(true);
  });

  it('boundary: exactly 14 days since last reactivation push → eligible', () => {
    const lastSent = new Date(NOW.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const member = makeMember({ lastReactivationSentAt: lastSent });
    expect(shouldReactivate(member, NOW)).toBe(true);
  });

  it('boundary: 13 days since last booking → not eligible', () => {
    const member = makeMember({ daysSinceLastBooking: 13 });
    expect(shouldReactivate(member, NOW)).toBe(false);
  });
});

describe('reactivation.service — buildReactivationPayload', () => {
  it('uses first name in the title', () => {
    const payload = buildReactivationPayload(makeMember({ fullName: 'Maria Schmidt' }), '');
    expect(payload.title).toBe('Maria, wir vermissen dich! 🎾');
  });

  it('falls back to "Hallo" when full name is null', () => {
    const payload = buildReactivationPayload(makeMember({ fullName: null }), '');
    expect(payload.title).toBe('Hallo, wir vermissen dich! 🎾');
  });

  it('uses first part of name when no spaces', () => {
    const payload = buildReactivationPayload(makeMember({ fullName: 'Madonna' }), '');
    expect(payload.title).toBe('Madonna, wir vermissen dich! 🎾');
  });

  it('mentions the day count in the body', () => {
    const payload = buildReactivationPayload(makeMember({ daysSinceLastBooking: 23 }), '');
    expect(payload.body).toContain('23 Tage');
  });

  it('falls back to threshold when daysSinceLastBooking is null', () => {
    const payload = buildReactivationPayload(
      makeMember({ daysSinceLastBooking: null }),
      ''
    );
    expect(payload.body).toContain(`${INACTIVITY_THRESHOLD_DAYS} Tage`);
  });

  it('points to /bookings when appUrl is empty', () => {
    const payload = buildReactivationPayload(makeMember(), '');
    expect(payload.url).toBe('/bookings');
  });

  it('prepends appUrl to /bookings', () => {
    const payload = buildReactivationPayload(makeMember(), 'https://app.swingz.de');
    expect(payload.url).toBe('https://app.swingz.de/bookings');
  });

  it('tags the notification with reactivation-{userId} for native grouping', () => {
    const payload = buildReactivationPayload(makeMember({ userId: 'u-abc-123' }), '');
    expect(payload.tag).toBe('reactivation-u-abc-123');
  });

  it('includes type:reactivation in data for client-side routing', () => {
    const payload = buildReactivationPayload(makeMember(), '');
    expect(payload.data?.type).toBe('reactivation');
    expect(payload.data?.userId).toBe('user-1');
    expect(payload.data?.clubId).toBe('club-1');
  });
});

// ─── Orchestration: ReactivationService.runReactivation ─────────────

const ACTIVE_PUSH = { success: true, sent: 1, failed: 0, cleanedUp: 0 };
const NO_PUSH = { success: true, sent: 0, failed: 0, cleanedUp: 0 };

/** Build a thenable query mock that resolves to the given value. The Supabase
 *  JS client returns a thenable builder; `await builder` triggers the request. */
function makeThenableQuery<T>(value: T) {
  const q: any = {};
  const chain = () => q;
  q.select = vi.fn(chain);
  q.eq = vi.fn(chain);
  q.in = vi.fn(chain);
  q.gte = vi.fn(chain);
  q.order = vi.fn(chain);
  q.limit = vi.fn(chain);
  q.maybeSingle = vi.fn(() => Promise.resolve(value));
  q.single = vi.fn(() => Promise.resolve(value));
  q.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(value).then(onFulfilled, onRejected);
  return q;
}

interface UpdateCall {
  payload: any;
  filters: Array<{ col: string; val: any }>;
}

interface MockSetup {
  updateCalls: UpdateCall[];
}

/**
 * Wire up createServiceClient + pushNotificationService mocks. Returns a
 * tracker for the update calls so tests can assert on mark-sent behavior.
 */
function setupMocks(
  opts: {
    memberships?: any[];
    bookings?: any[];
    pushResults?: Record<string, { success: boolean; sent: number; failed: number; cleanedUp: number }>;
    markError?: any;
  } = {}
): MockSetup {
  const { memberships = [], bookings = [], pushResults = {}, markError = null } = opts;
  const updateCalls: UpdateCall[] = [];

  const mockFrom = vi.fn();
  mockFrom.mockImplementation((table: string) => {
    if (table === 'user_club_memberships') {
      return {
        select: vi.fn(() => makeThenableQuery({ data: memberships, error: null })),
        update: vi.fn((payload: any) => {
          const chain: any = {};
          const filters: Array<{ col: string; val: any }> = [];
          chain.eq = vi.fn((col: string, val: any) => {
            filters.push({ col, val });
            return chain;
          });
          chain.in = vi.fn((col: string, val: any) => {
            filters.push({ col, val });
            return chain;
          });
          chain.then = (onFulfilled: any, onRejected: any) => {
            updateCalls.push({ payload, filters });
            return Promise.resolve({ data: null, error: markError }).then(
              onFulfilled,
              onRejected
            );
          };
          return chain;
        }),
      };
    }
    if (table === 'bookings') {
      return {
        select: vi.fn(() => makeThenableQuery({ data: bookings, error: null })),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  vi.mocked(createServiceClient).mockReturnValue({ from: mockFrom } as any);
  vi.mocked(pushNotificationService.sendToUser).mockImplementation(
    async (userId: string, _payload: PushPayload) => pushResults[userId] ?? NO_PUSH
  );

  return { updateCalls };
}

function makeMembership(userId: string, name: string, extras: Record<string, any> = {}) {
  return {
    user_id: userId,
    club_id: 'c1',
    last_reactivation_sent_at: null,
    reactivation_count: 0,
    users: { full_name: name },
    ...extras,
  };
}

function makeBooking(userId: string, daysAgo: number) {
  return {
    member_id: userId,
    created_at: new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
  };
}

describe('ReactivationService.runReactivation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('find → send → mark: a single inactive member gets push + mark-sent', async () => {
    const { updateCalls } = setupMocks({
      memberships: [makeMembership('u1', 'Alice')],
      bookings: [makeBooking('u1', 20)],
      pushResults: { u1: ACTIVE_PUSH },
    });

    const result = await ReactivationService.runReactivation();

    expect(result).toEqual({ total: 1, sent: 1, failed: 0, skipped: 0, errors: [] });
    expect(pushNotificationService.sendToUser).toHaveBeenCalledTimes(1);
    expect(pushNotificationService.sendToUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        title: expect.stringContaining('Alice'),
        tag: 'reactivation-u1',
        data: expect.objectContaining({
          type: 'reactivation',
          userId: 'u1',
          clubId: 'c1',
          daysSinceLastBooking: 20,
        }),
      })
    );
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].payload).toMatchObject({ reactivation_count: 1 });
    expect(updateCalls[0].payload.last_reactivation_sent_at).toBe(NOW.toISOString());
    expect(updateCalls[0].filters).toEqual([
      { col: 'user_id', val: 'u1' },
      { col: 'club_id', val: 'c1' },
    ]);
  });

  it('per-member try/catch isolation: one member throws, others succeed', async () => {
    const { updateCalls } = setupMocks({
      memberships: [
        makeMembership('u1', 'Alice'),
        makeMembership('u2', 'Bob'),
        makeMembership('u3', 'Carol'),
      ],
      bookings: [
        makeBooking('u1', 20),
        makeBooking('u2', 20),
        makeBooking('u3', 20),
      ],
      pushResults: { u1: ACTIVE_PUSH, u3: ACTIVE_PUSH },
    });

    // Override: u2 throws (simulates VAPID/network error for one user)
    vi.mocked(pushNotificationService.sendToUser).mockImplementation(
      async (userId: string, _payload: PushPayload) => {
        if (userId === 'u2') throw new Error('VAPID error');
        return ACTIVE_PUSH;
      }
    );

    const result = await ReactivationService.runReactivation();

    expect(result.total).toBe(3);
    expect(result.sent).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.errors).toEqual([{ userId: 'u2', error: 'VAPID error' }]);
    // All 3 sends attempted — no early bail
    expect(pushNotificationService.sendToUser).toHaveBeenCalledTimes(3);
    // u1 and u3 got mark-sent; u2 did not
    expect(updateCalls).toHaveLength(2);
    const markedUserIds = updateCalls.map((c) => c.filters[0].val);
    expect(markedUserIds).toEqual(expect.arrayContaining(['u1', 'u3']));
    expect(markedUserIds).not.toContain('u2');
  });

  it('skipped-no-subscription: sendToUser returns sent: 0 → no mark-sent, counted as skipped', async () => {
    const { updateCalls } = setupMocks({
      memberships: [makeMembership('u1', 'Alice')],
      bookings: [makeBooking('u1', 20)],
      pushResults: { u1: NO_PUSH }, // user has no active push sub
    });

    const result = await ReactivationService.runReactivation();

    expect(result).toEqual({ total: 1, sent: 0, failed: 0, skipped: 1, errors: [] });
    expect(pushNotificationService.sendToUser).toHaveBeenCalledTimes(1);
    // No mark-sent update should have been called (the push didn't go out)
    expect(updateCalls).toHaveLength(0);
  });

  it('mark-sent fail: push went out but update fails → counted as failed, not sent', async () => {
    const { updateCalls } = setupMocks({
      memberships: [makeMembership('u1', 'Alice')],
      bookings: [makeBooking('u1', 20)],
      pushResults: { u1: ACTIVE_PUSH },
      markError: { message: 'DB write failed' },
    });

    const result = await ReactivationService.runReactivation();

    // The push was delivered (sent=1 from sendToUser) but the mark-sent failed.
    // Per the service contract: counted as failed, not sent, with markSent: prefix.
    expect(result).toEqual({
      total: 1,
      sent: 0,
      failed: 1,
      skipped: 0,
      errors: [{ userId: 'u1', error: 'markSent: DB write failed' }],
    });
    expect(updateCalls).toHaveLength(1); // the update was attempted
    expect(pushNotificationService.sendToUser).toHaveBeenCalledTimes(1);
  });

  it('all-in-cooldown: every member in cooldown → no sends, all skipped', async () => {
    const sevenDaysAgo = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { updateCalls } = setupMocks({
      memberships: [
        makeMembership('u1', 'Alice', { last_reactivation_sent_at: sevenDaysAgo }),
        makeMembership('u2', 'Bob', { last_reactivation_sent_at: sevenDaysAgo }),
      ],
      bookings: [makeBooking('u1', 20), makeBooking('u2', 20)],
    });

    const result = await ReactivationService.runReactivation();

    expect(result).toEqual({ total: 2, sent: 0, failed: 0, skipped: 2, errors: [] });
    expect(pushNotificationService.sendToUser).not.toHaveBeenCalled();
    expect(updateCalls).toHaveLength(0);
  });

  it('find failure: when findInactiveMembers throws, no pushes are attempted', async () => {
    // Override: from('user_club_memberships') throws synchronously
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'user_club_memberships') {
        throw new Error('DB down');
      }
      return { select: vi.fn(() => makeThenableQuery({ data: [], error: null })) };
    });
    vi.mocked(createServiceClient).mockReturnValue({ from: mockFrom } as any);

    const result = await ReactivationService.runReactivation();

    expect(result.total).toBe(0);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].userId).toBe('*');
    expect(result.errors[0].error).toBe('findInactiveMembers: DB down');
    expect(pushNotificationService.sendToUser).not.toHaveBeenCalled();
  });
});

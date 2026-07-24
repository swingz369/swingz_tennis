/**
 * Unit-tests for the new `authorizeSeasonAccess` helper.
 *
 * Covers the four major decision branches:
 *  1. Season lookup: empty / null / not-found / DB-throws
 *  2. Platform-staff fast path: owner / superadmin bypass
 *  3. requireClubMembership default (true): matching membership + role whitelist
 *  4. requireClubMembership = false: role-only path
 *
 * Mocks `@/src/infrastructure/persistence/db` so the helper is tested in
 * isolation — no Supabase fixture required.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';

// ── Mock the DB BEFORE the helper import resolves. The helper imports
//    `db` from the persistence barrel; this mock intercepts that import.
vi.mock('@/src/infrastructure/persistence/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import { authorizeSeasonAccess, loadSeasonRow } from '@/lib/season-auth';
import type { AuthContext } from '@/lib/api-auth';
import { db } from '@/src/infrastructure/persistence/db';

// ── Test fixtures
const SEASON_UUID = '11111111-1111-1111-1111-111111111111';
const CLUB_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CLUB_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

type Membership = {
  club_id: string;
  role: 'admin' | 'trainer' | 'member' | 'superadmin';
};

function makeAuth(
  authRole: 'admin' | 'member' | 'trainer' | 'superadmin' | 'owner',
  memberships: Membership[] = [],
  clubId?: string
): AuthContext {
  return {
    user: { id: 'user-1', email: 'u@example.com' },
    supabase: {} as never,
    role: authRole,
    clubId,
    memberships,
  } as unknown as AuthContext;
}

/**
 * Make the mocked `db.select().from(...).where(...).limit(1)` chain resolve
 * to `[row]`. The helper uses exactly this shape.
 */
function mockSeasonRow(row: { id: string; club_id: string } | null): void {
  const limit = vi.fn().mockResolvedValue(row ? [row] : []);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  vi.mocked(db.select).mockReturnValue({ from } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────
// 1) Season lookup
// ─────────────────────────────────────────────────────────────────────
describe('authorizeSeasonAccess — season lookup', () => {
  it('returns 404 when seasonId is empty', async () => {
    const result = await authorizeSeasonAccess(makeAuth('admin', []), '');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(404);
  });

  it('returns 404 when the season does not exist', async () => {
    mockSeasonRow(null);
    const result = await authorizeSeasonAccess(makeAuth('admin'), SEASON_UUID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(404);
  });

  it('returns 500 when the DB throws', async () => {
    const limit = vi.fn().mockRejectedValue(new Error('connection refused'));
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    vi.mocked(db.select).mockReturnValue({ from } as never);

    const result = await authorizeSeasonAccess(makeAuth('admin'), SEASON_UUID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 2) Platform-staff fast path (owner / superadmin bypass membership check)
// ─────────────────────────────────────────────────────────────────────
describe('authorizeSeasonAccess — platform-staff bypass', () => {
  it('owner bypasses club-membership check (any season, any club)', async () => {
    mockSeasonRow({ id: SEASON_UUID, club_id: CLUB_A });
    const auth = makeAuth('owner'); // no memberships, no clubId
    const result = await authorizeSeasonAccess(auth, SEASON_UUID, {
      allowedRoles: ['admin'],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.effectiveRole).toBe('owner');
  });

  it('superadmin bypasses club-membership check', async () => {
    mockSeasonRow({ id: SEASON_UUID, club_id: CLUB_A });
    const auth = makeAuth('superadmin');
    const result = await authorizeSeasonAccess(auth, SEASON_UUID);
    expect(result.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 3) requireClubMembership = true (default): membership + role whitelist
// ─────────────────────────────────────────────────────────────────────
describe('authorizeSeasonAccess — club-membership boundary', () => {
  beforeEach(() => {
    mockSeasonRow({ id: SEASON_UUID, club_id: CLUB_A });
  });

  it("admin of the season's club is granted", async () => {
    const auth = makeAuth('admin', [{ club_id: CLUB_A, role: 'admin' }], CLUB_A);
    const result = await authorizeSeasonAccess(auth, SEASON_UUID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.season.id).toBe(SEASON_UUID);
      expect(result.effectiveRole).toBe('admin');
    }
  });

  it('admin of a different club is forbidden (cross-club IDOR)', async () => {
    const auth = makeAuth('admin', [{ club_id: CLUB_B, role: 'admin' }], CLUB_B);
    const result = await authorizeSeasonAccess(auth, SEASON_UUID, {
      allowedRoles: ['admin'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it('trainer of the right club is granted when role whitelist includes trainer', async () => {
    const auth = makeAuth('trainer', [{ club_id: CLUB_A, role: 'trainer' }], CLUB_A);
    const result = await authorizeSeasonAccess(auth, SEASON_UUID, {
      allowedRoles: ['admin', 'trainer'],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.effectiveRole).toBe('trainer');
  });

  it('trainer of right club is forbidden when whitelist is admin-only', async () => {
    const auth = makeAuth('trainer', [{ club_id: CLUB_A, role: 'trainer' }], CLUB_A);
    const result = await authorizeSeasonAccess(auth, SEASON_UUID, {
      allowedRoles: ['admin'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it('user without any membership is forbidden', async () => {
    const auth = makeAuth('member', [], undefined); // empty memberships
    const result = await authorizeSeasonAccess(auth, SEASON_UUID, {
      allowedRoles: ['admin', 'member'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 4) requireClubMembership = false: role-only path
// ─────────────────────────────────────────────────────────────────────
describe('authorizeSeasonAccess — role-only mode', () => {
  it('grants when caller has any allowed role via global auth.role', async () => {
    mockSeasonRow({ id: SEASON_UUID, club_id: CLUB_A });
    const auth = makeAuth('admin'); // global admin, no memberships needed
    const result = await authorizeSeasonAccess(auth, SEASON_UUID, {
      requireClubMembership: false,
      allowedRoles: ['admin'],
    });
    expect(result.ok).toBe(true);
  });

  it('grants when caller has an allowed role via memberships (but not global)', async () => {
    mockSeasonRow({ id: SEASON_UUID, club_id: CLUB_A });
    const auth = makeAuth('member', [{ club_id: CLUB_A, role: 'trainer' }]);
    const result = await authorizeSeasonAccess(auth, SEASON_UUID, {
      requireClubMembership: false,
      allowedRoles: ['trainer'],
    });
    expect(result.ok).toBe(true);
  });

  it('denies when neither global nor membership role matches', async () => {
    mockSeasonRow({ id: SEASON_UUID, club_id: CLUB_A });
    const auth = makeAuth('member', [{ club_id: CLUB_A, role: 'member' }]);
    const result = await authorizeSeasonAccess(auth, SEASON_UUID, {
      requireClubMembership: false,
      allowedRoles: ['admin'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────
// loadSeasonRow (no auth check) — sanity
// ─────────────────────────────────────────────────────────────────────
describe('loadSeasonRow', () => {
  it('returns the season row on hit', async () => {
    mockSeasonRow({ id: SEASON_UUID, club_id: CLUB_A });
    const result = await loadSeasonRow(SEASON_UUID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.season.club_id).toBe(CLUB_A);
  });

  it('returns 404 on miss', async () => {
    mockSeasonRow(null);
    const result = await loadSeasonRow(SEASON_UUID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(404);
  });
});

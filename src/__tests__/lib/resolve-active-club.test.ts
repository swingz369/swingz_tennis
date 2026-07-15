/**
 * Unit tests for `resolveActiveClub` — single-source-of-truth cookie-aware
 * clubId resolver.
 *
 * The helper is pure (no DB or Supabase calls), so these are direct unit
 * tests — no `vi.mock` of persistence layer needed.
 *
 * Covers the 5 cases requested by the original spec, plus strategy variants
 * for the api-auth use case.
 */

import { describe, expect, it } from 'vitest';
import { resolveActiveClub } from '@/lib/auth/resolve-active-club';
import type { ActiveMembership } from '@/lib/auth/resolve-active-club';

const CLUB_OWNED_BY_ADMIN = '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CLUB_COOKIE_VALID = '22222222-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CLUB_COOKIE_INVALID = '99999999-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const adminMembership: ActiveMembership[] = [{ role: 'admin', club_id: CLUB_OWNED_BY_ADMIN }];

const superadminManyClubs: ActiveMembership[] = [
  { role: 'superadmin', club_id: 'sa-club-1' },
  { role: 'superadmin', club_id: 'sa-club-2' },
  { role: 'superadmin', club_id: 'sa-club-3' },
];

const superadminOneClubMatchingOtherCookie: ActiveMembership[] = [
  { role: 'superadmin', club_id: 'sa-club-1' },
];

// ─────────────────────────────────────────────────────────────────────
// 1) cookie invalid + admin membership present → fallback to admin club
// ─────────────────────────────────────────────────────────────────────
describe('resolveActiveClub — admin branch', () => {
  it('cookie invalid (different from admin club) → falls back to admin club', async () => {
    const result = await resolveActiveClub({
      cookieValue: CLUB_COOKIE_INVALID,
      memberships: adminMembership,
      highestRole: 'admin',
    });
    expect(result.clubId).toBe(CLUB_OWNED_BY_ADMIN);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('fallback');
    expect(result.resolvedRole).toBe('admin');
  });

  // 2) cookie null + admin has 1 club → resolve to that club
  it('cookie null + admin has 1 club → falls back to admin club', async () => {
    const result = await resolveActiveClub({
      cookieValue: null,
      memberships: adminMembership,
      highestRole: 'admin',
    });
    expect(result.clubId).toBe(CLUB_OWNED_BY_ADMIN);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('fallback');
    expect(result.resolvedRole).toBe('admin');
  });

  it('cookie undefined (NextRequest shape from api-auth) → falls back to admin club', async () => {
    const result = await resolveActiveClub({
      cookieValue: undefined,
      memberships: adminMembership,
      highestRole: 'admin',
    });
    expect(result.clubId).toBe(CLUB_OWNED_BY_ADMIN);
    expect(result.reason).toBe('fallback');
  });

  it('cookie empty string → treated as null, falls back to admin club', async () => {
    const result = await resolveActiveClub({
      cookieValue: '',
      memberships: adminMembership,
      highestRole: 'admin',
    });
    expect(result.clubId).toBe(CLUB_OWNED_BY_ADMIN);
    expect(result.reason).toBe('fallback');
  });

  it('cookie valid (matches admin membership) → isValid=true, clubId=cookie', async () => {
    const result = await resolveActiveClub({
      cookieValue: CLUB_OWNED_BY_ADMIN,
      memberships: adminMembership,
      highestRole: 'admin',
    });
    expect(result.clubId).toBe(CLUB_OWNED_BY_ADMIN);
    expect(result.isValid).toBe(true);
    expect(result.reason).toBe('fallback');
    expect(result.resolvedRole).toBe('admin');
  });

  it('admin has only null-club_id memberships + cookie set → null, cookie-no-membership', async () => {
    const result = await resolveActiveClub({
      cookieValue: CLUB_COOKIE_INVALID,
      memberships: [{ role: 'admin', club_id: null }],
      highestRole: 'admin',
    });
    expect(result.clubId).toBe(null);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('cookie-no-membership');
  });

  it('admin has only null-club_id memberships + no cookie → null, no-cookie', async () => {
    const result = await resolveActiveClub({
      cookieValue: null,
      memberships: [{ role: 'admin', club_id: null }],
      highestRole: 'admin',
    });
    expect(result.clubId).toBe(null);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('no-cookie');
  });
});

// ─────────────────────────────────────────────────────────────────────
// 3) cookie null + superadmin has many clubs → null
// ─────────────────────────────────────────────────────────────────────
describe('resolveActiveClub — superadmin / owner branch', () => {
  it('cookie null + superadmin with many clubs → null, no-cookie', async () => {
    const result = await resolveActiveClub({
      cookieValue: null,
      memberships: superadminManyClubs,
      highestRole: 'superadmin',
    });
    expect(result.clubId).toBe(null);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('no-cookie');
    expect(result.resolvedRole).toBe('superadmin');
  });

  // 4) cookie present + superadmin not member of cookie-club → null
  it('cookie present + superadmin not member of cookie-club → null, cookie-no-membership', async () => {
    const result = await resolveActiveClub({
      cookieValue: CLUB_COOKIE_INVALID,
      memberships: superadminOneClubMatchingOtherCookie,
      highestRole: 'superadmin',
    });
    expect(result.clubId).toBe(null);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('cookie-no-membership');
    expect(result.resolvedRole).toBe('superadmin');
  });

  it('superadmin cookie matches a superadmin membership → isValid=true', async () => {
    const result = await resolveActiveClub({
      cookieValue: 'sa-club-1',
      memberships: superadminOneClubMatchingOtherCookie,
      highestRole: 'superadmin',
    });
    expect(result.clubId).toBe('sa-club-1');
    expect(result.isValid).toBe(true);
    expect(result.reason).toBe('fallback');
  });

  it('superadmin with no memberships + no cookie → null, no-cookie', async () => {
    const result = await resolveActiveClub({
      cookieValue: null,
      memberships: [],
      highestRole: 'superadmin',
    });
    expect(result.clubId).toBe(null);
    expect(result.reason).toBe('no-cookie');
  });
});

// ─────────────────────────────────────────────────────────────────────
// 5) owner (no memberships) → null with no-cookie reason
//
// User spec: "owner (no memberships)" — interpreted as no cookie set.
// If an owner supplies a cookie without memberships under default
// ('membership-match') strategy, we honor the input-state semantic
// and report 'cookie-no-membership' — distinguishing no-cookie vs.
// cookie-was-supplied-but-rejected states.
// ─────────────────────────────────────────────────────────────────────
describe('resolveActiveClub — owner (platform-staff w/o memberships)', () => {
  it('owner with no memberships + no cookie (user-spec case 5) → null, no-cookie', async () => {
    const result = await resolveActiveClub({
      cookieValue: null,
      memberships: [],
      highestRole: 'owner',
    });
    expect(result.clubId).toBe(null);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('no-cookie');
    expect(result.resolvedRole).toBe('owner');
  });

  it('owner with no memberships + cookie set under default strategy → null, cookie-no-membership', async () => {
    // Documented edge case: cookie is set but owner has no memberships to
    // validate against. Helper stays consistent with cookie-state semantics.
    const result = await resolveActiveClub({
      cookieValue: CLUB_COOKIE_VALID,
      memberships: [],
      highestRole: 'owner',
    });
    expect(result.clubId).toBe(null);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('cookie-no-membership');
    expect(result.resolvedRole).toBe('owner');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Trainer / Member: helper does NOT resolve a club (callers use their
// own context helpers). Just verify the helper returns null.
// ─────────────────────────────────────────────────────────────────────
describe('resolveActiveClub — trainer / member callers', () => {
  it('trainer role → null regardless of cookie', async () => {
    const result = await resolveActiveClub({
      cookieValue: CLUB_COOKIE_VALID,
      memberships: [{ role: 'trainer', club_id: 'trainer-home' }],
      highestRole: 'trainer',
    });
    expect(result.clubId).toBe(null);
    expect(result.reason).toBe('no-cookie');
  });

  it('member role → null regardless of cookie', async () => {
    const result = await resolveActiveClub({
      cookieValue: CLUB_COOKIE_VALID,
      memberships: [{ role: 'member', club_id: 'member-home' }],
      highestRole: 'member',
    });
    expect(result.clubId).toBe(null);
    expect(result.reason).toBe('no-cookie');
  });
});

// ─────────────────────────────────────────────────────────────────────
// platformStaffCookieStrategy='club-exists' — api-auth use case
// ─────────────────────────────────────────────────────────────────────
describe('resolveActiveClub — club-exists strategy (api-auth)', () => {
  it('superadmin cookie pointing at existing club → honored', async () => {
    const result = await resolveActiveClub({
      cookieValue: CLUB_COOKIE_VALID,
      memberships: [], // no memberships; superadmin strategy with club-exists doesn't need them
      highestRole: 'superadmin',
      strategy: {
        type: 'club-exists',
        clubExists: async (id) => id === CLUB_COOKIE_VALID,
      },
    });
    expect(result.clubId).toBe(CLUB_COOKIE_VALID);
    expect(result.isValid).toBe(true);
    expect(result.reason).toBe('fallback');
  });

  it('superadmin cookie pointing at NON-existent club → null, cookie-no-membership', async () => {
    const result = await resolveActiveClub({
      cookieValue: 'phantom-club',
      memberships: [{ role: 'superadmin', club_id: null }],
      highestRole: 'superadmin',
      strategy: {
        type: 'club-exists',
        clubExists: async () => false,
      },
    });
    expect(result.clubId).toBe(null);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('cookie-no-membership');
  });

  it('owner cookie pointing at existing club → honored via club-exists', async () => {
    const result = await resolveActiveClub({
      cookieValue: CLUB_COOKIE_VALID,
      memberships: [],
      highestRole: 'owner',
      strategy: {
        type: 'club-exists',
        clubExists: async (id) => id === CLUB_COOKIE_VALID,
      },
    });
    expect(result.clubId).toBe(CLUB_COOKIE_VALID);
    expect(result.isValid).toBe(true);
    expect(result.reason).toBe('fallback');
    expect(result.resolvedRole).toBe('owner');
  });

  it('discriminated union: passing strategy=club-exists without clubExists is a TS error', () => {
    // This test is a compile-time check only — runtime just verifies the type compiles.
    // If you see this test break, the discriminated union was removed.
    type _Check = Parameters<typeof resolveActiveClub>[0];
    // @ts-expect-error — must provide clubExists when type='club-exists'
    const _bad: _Check = {
      cookieValue: null,
      memberships: [],
      highestRole: 'owner',
      strategy: { type: 'club-exists' },
    };
    void _bad;
  });
});

// ─────────────────────────────────────────────────────────────────────
// Type-system invariant: required highestRole
// ─────────────────────────────────────────────────────────────────────
describe('resolveActiveClub — required highestRole', () => {
  it('compile error when highestRole is missing (TS only)', () => {
    type _Check = Parameters<typeof resolveActiveClub>[0];
    // @ts-expect-error — highestRole is required
    const _bad: _Check = {
      cookieValue: null,
      memberships: [],
    };
    void _bad;
  });
});

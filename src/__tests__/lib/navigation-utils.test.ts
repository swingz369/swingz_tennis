/**
 * Unit tests for navigation utility helpers.
 *
 * Tests lib/navigation-utils.ts — pure functions with no dependencies.
 */
import { describe, it, expect } from 'vitest';
import { isActivePath, isExactActive } from '@/lib/navigation-utils';

// ════════════════════════════════════════════════════════════
// isActivePath
// ════════════════════════════════════════════════════════════

describe('isActivePath', () => {
  // ── Exact matches ──

  it('returns true for exact match', () => {
    expect(isActivePath('/admin/members', '/admin/members')).toBe(true);
  });

  it('returns true for exact match on root', () => {
    expect(isActivePath('/admin', '/admin')).toBe(true);
  });

  it('returns true for exact match on root path', () => {
    expect(isActivePath('/', '/')).toBe(true);
  });

  // ── Prefix matches ──

  it('returns true when current path is a sub-path of href', () => {
    expect(isActivePath('/admin/members/123', '/admin/members')).toBe(true);
  });

  it('returns true for deeply nested sub-path', () => {
    expect(isActivePath('/admin/seasons/42/planning/step/3', '/admin/seasons')).toBe(true);
  });

  it('returns true when href matches exactly and current is deeper', () => {
    expect(isActivePath('/superadmin/tenants/abc/settings', '/superadmin/tenants')).toBe(true);
  });

  // ── Non-matches: root prefix boundaries ──

  it('returns false when href is a root page and current is deeper (no over-match)', () => {
    // /admin should NOT match /admin/members — it would be overbroad
    expect(isActivePath('/admin/members', '/admin')).toBe(false);
  });

  it('returns false when href is root and current is unrelated sub-path', () => {
    expect(isActivePath('/admin/seasons/42', '/admin')).toBe(false);
  });

  it('returns false when href is / and current is deeper', () => {
    expect(isActivePath('/admin', '/')).toBe(false);
  });

  // ── Non-matches: completely different paths ──

  it('returns false for completely different paths', () => {
    expect(isActivePath('/admin/members', '/profile')).toBe(false);
  });

  it('returns false for paths that share prefix but are different segments', () => {
    // /admin/member should NOT match /admin/members (not a prefix match)
    expect(isActivePath('/admin/members/123', '/admin/member')).toBe(false);
  });

  it('returns false when only a partial segment matches', () => {
    // /trainer is not a prefix of /trainers (different segment)
    expect(isActivePath('/trainers/123', '/trainer')).toBe(false);
  });

  // ── Null / empty pathname ──

  it('returns false when currentPath is null', () => {
    expect(isActivePath(null, '/admin')).toBe(false);
  });

  it('returns false when currentPath is null even with exactOnly false', () => {
    expect(isActivePath(null, '/admin', false)).toBe(false);
  });

  // ── exactOnly mode ──

  it('returns false for sub-path when exactOnly is true', () => {
    expect(isActivePath('/admin/members/123', '/admin/members', true)).toBe(false);
  });

  it('returns true for exact match when exactOnly is true', () => {
    expect(isActivePath('/admin/members', '/admin/members', true)).toBe(true);
  });

  it('returns false for different path when exactOnly is true', () => {
    expect(isActivePath('/admin/members', '/profile', true)).toBe(false);
  });

  it('returns false for root prefix when exactOnly is true', () => {
    expect(isActivePath('/admin/members', '/admin', true)).toBe(false);
  });

  // ── Edge cases ──

  it('handles trailing slashes: /admin/ vs /admin', () => {
    // /admin/ is a different path than /admin — no automatic normalisation
    expect(isActivePath('/admin/', '/admin')).toBe(false);
  });

  it('handles trailing slashes: sub-path with trailing slash', () => {
    // /admin/members/ should match as prefix of /admin/members/123
    expect(isActivePath('/admin/members/123', '/admin/members/')).toBe(true);
  });

  it('handles query-string-like paths (treated literally)', () => {
    // isActivePath does not parse query strings — literal comparison
    expect(isActivePath('/admin/members?tab=active', '/admin/members')).toBe(false);
  });

  it('handles hash paths (treated literally)', () => {
    expect(isActivePath('/dashboard#section', '/dashboard')).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════
// isExactActive
// ════════════════════════════════════════════════════════════

describe('isExactActive', () => {
  it('returns true for exact match', () => {
    expect(isExactActive('/admin', '/admin')).toBe(true);
  });

  it('returns true for exact match on nested path', () => {
    expect(isExactActive('/admin/members/123', '/admin/members/123')).toBe(true);
  });

  it('returns false for sub-path (should not prefix-match)', () => {
    expect(isExactActive('/admin/members/123', '/admin/members')).toBe(false);
  });

  it('returns false for parent path', () => {
    expect(isExactActive('/admin/members', '/admin/members/123')).toBe(false);
  });

  it('returns false for completely different path', () => {
    expect(isExactActive('/admin', '/profile')).toBe(false);
  });

  it('returns false when currentPath is null', () => {
    expect(isExactActive(null, '/admin')).toBe(false);
  });

  it('returns true for root path exact match', () => {
    expect(isExactActive('/', '/')).toBe(true);
  });

  it('returns false for root vs sub-path', () => {
    expect(isExactActive('/admin', '/')).toBe(false);
  });

  // ── Behaviour matches isActivePath with exactOnly=true ──

  it('behaves identically to isActivePath(path, href, true)', () => {
    const cases = [
      ['/admin', '/admin'],
      ['/admin/members', '/admin'],
      ['/admin/members/123', '/admin/members'],
      ['/profile', '/admin'],
      [null, '/admin'],
    ] as const;

    for (const [current, href] of cases) {
      expect(isExactActive(current, href)).toBe(isActivePath(current, href, true));
    }
  });
});

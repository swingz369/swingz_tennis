import { describe, it, expect } from 'vitest';
import {
  getRsvpStatusBadge,
  normalizeRsvpStatus,
  getRsvpStatusConfig,
  RSVP_STATUS_CONFIG,
  RSVP_ACTION_KEYS,
  type RsvpStatusKey,
} from '@/lib/rsvp-status';

describe('getRsvpStatusBadge', () => {
  // ─── Path 1: Zusage (green) ───────────────────────────────────────────
  describe('Zusage (accepted/attending/yes)', () => {
    it('returns Zusage badge for "yes"', () => {
      const badge = getRsvpStatusBadge('yes');
      expect(badge).not.toBeNull();
      expect(badge?.label).toBe('Zusage');
      expect(badge?.color).toBe('bg-green-100 text-green-700 border-green-200');
    });

    it('returns Zusage badge for "attending"', () => {
      const badge = getRsvpStatusBadge('attending');
      expect(badge?.label).toBe('Zusage');
      expect(badge?.color).toContain('green-100');
    });

    it('returns Zusage badge for "accepted" (case-insensitive)', () => {
      const badge = getRsvpStatusBadge('Accepted');
      expect(badge?.label).toBe('Zusage');
      expect(badge?.color).toContain('green-100');
    });
  });

  // ─── Path 2: Absage (red) ─────────────────────────────────────────────
  describe('Absage (declined/no)', () => {
    it('returns Absage badge for "no"', () => {
      const badge = getRsvpStatusBadge('no');
      expect(badge).not.toBeNull();
      expect(badge?.label).toBe('Absage');
      expect(badge?.color).toBe('bg-red-100 text-red-700 border-red-200');
    });

    it('returns Absage badge for "declined"', () => {
      const badge = getRsvpStatusBadge('declined');
      expect(badge?.label).toBe('Absage');
      expect(badge?.color).toContain('red-100');
    });
  });

  // ─── Path 3: Vielleicht (amber) ───────────────────────────────────────
  describe('Vielleicht (maybe/tentative)', () => {
    it('returns Vielleicht badge for "maybe"', () => {
      const badge = getRsvpStatusBadge('maybe');
      expect(badge).not.toBeNull();
      expect(badge?.label).toBe('Vielleicht');
      expect(badge?.color).toBe('bg-amber-100 text-amber-700 border-amber-200');
    });

    it('returns Vielleicht badge for "tentative"', () => {
      const badge = getRsvpStatusBadge('tentative');
      expect(badge?.label).toBe('Vielleicht');
      expect(badge?.color).toContain('amber-100');
    });
  });

  // ─── Path 4: Wartet auf Antwort (blue) ────────────────────────────────
  describe('Wartet auf Antwort (pending/waiting)', () => {
    it('returns "Wartet auf Antwort" badge for "pending"', () => {
      const badge = getRsvpStatusBadge('pending');
      expect(badge).not.toBeNull();
      expect(badge?.label).toBe('Wartet auf Antwort');
      expect(badge?.color).toBe('bg-blue-100 text-blue-700 border-blue-200');
    });

    it('returns "Wartet auf Antwort" badge for "waiting"', () => {
      const badge = getRsvpStatusBadge('waiting');
      expect(badge?.label).toBe('Wartet auf Antwort');
      expect(badge?.color).toContain('blue-100');
    });
  });

  // ─── Path 5: null / undefined / empty ─────────────────────────────────
  describe('null / undefined / empty input', () => {
    it('returns null for null input', () => {
      expect(getRsvpStatusBadge(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(getRsvpStatusBadge(undefined)).toBeNull();
    });

    it('returns null for empty string input', () => {
      expect(getRsvpStatusBadge('')).toBeNull();
    });
  });

  // ─── Icon present on every non-null return ────────────────────────────
  describe('icon presence', () => {
    it('always returns an icon component for any non-null badge', () => {
      const statuses = ['yes', 'no', 'maybe', 'pending', 'attending', 'declined'];
      for (const s of statuses) {
        const badge = getRsvpStatusBadge(s);
        expect(badge?.icon, `icon missing for status "${s}"`).toBeDefined();
      }
    });
  });
});

// =====================================================================
// normalizeRsvpStatus
// =====================================================================
describe('normalizeRsvpStatus', () => {
  it('normalizes "yes" / "attending" / "accepted" / "confirmed" → accepted', () => {
    expect(normalizeRsvpStatus('yes')).toBe('accepted');
    expect(normalizeRsvpStatus('attending')).toBe('accepted');
    expect(normalizeRsvpStatus('accepted')).toBe('accepted');
    expect(normalizeRsvpStatus('confirmed')).toBe('accepted');
    expect(normalizeRsvpStatus('Accepted')).toBe('accepted');
  });

  it('normalizes "no" / "declined" / "rejected" → declined', () => {
    expect(normalizeRsvpStatus('no')).toBe('declined');
    expect(normalizeRsvpStatus('declined')).toBe('declined');
    expect(normalizeRsvpStatus('rejected')).toBe('declined');
  });

  it('normalizes "maybe" / "tentative" → maybe', () => {
    expect(normalizeRsvpStatus('maybe')).toBe('maybe');
    expect(normalizeRsvpStatus('tentative')).toBe('maybe');
  });

  it('normalizes "pending" / "waiting" / "no_response" → pending', () => {
    expect(normalizeRsvpStatus('pending')).toBe('pending');
    expect(normalizeRsvpStatus('waiting')).toBe('pending');
    expect(normalizeRsvpStatus('no_response')).toBe('pending');
  });

  it('normalizes null / undefined / empty string → pending (not unknown)', () => {
    expect(normalizeRsvpStatus(null)).toBe('pending');
    expect(normalizeRsvpStatus(undefined)).toBe('pending');
    expect(normalizeRsvpStatus('')).toBe('pending');
  });

  it('normalizes unknown values → "unknown" (preserved for visibility)', () => {
    expect(normalizeRsvpStatus('foo-bar')).toBe('unknown');
    expect(normalizeRsvpStatus('🤷')).toBe('unknown');
  });

  it('trims whitespace before normalizing', () => {
    expect(normalizeRsvpStatus('  yes  ')).toBe('accepted');
    expect(normalizeRsvpStatus(' Maybe ')).toBe('maybe');
  });
});

// =====================================================================
// getRsvpStatusConfig
// =====================================================================
describe('getRsvpStatusConfig', () => {
  it('returns the same config as direct map access for canonical keys', () => {
    const keys: RsvpStatusKey[] = ['accepted', 'declined', 'maybe', 'pending', 'unknown'];
    for (const k of keys) {
      expect(getRsvpStatusConfig(k).key).toBe(k);
      expect(getRsvpStatusConfig(k).label).toBe(RSVP_STATUS_CONFIG[k].label);
    }
  });

  it('normalizes raw strings before lookup', () => {
    expect(getRsvpStatusConfig('yes').key).toBe('accepted');
    expect(getRsvpStatusConfig('declined').key).toBe('declined');
    expect(getRsvpStatusConfig('garbage').key).toBe('unknown');
  });
});

// =====================================================================
// RSVP_ACTION_KEYS
// =====================================================================
describe('RSVP_ACTION_KEYS', () => {
  it('contains exactly the 3 user-actionable statuses (excludes pending/unknown)', () => {
    expect(RSVP_ACTION_KEYS).toEqual(['accepted', 'declined', 'maybe']);
  });

  it('does not include pending or unknown', () => {
    expect(RSVP_ACTION_KEYS).not.toContain('pending');
    expect(RSVP_ACTION_KEYS).not.toContain('unknown');
  });
});

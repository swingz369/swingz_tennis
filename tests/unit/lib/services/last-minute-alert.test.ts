/**
 * tests/unit/lib/services/last-minute-alert.test.ts
 *
 * Sprint 4 Q2 — Ticket 2.5.1 (Last-Minute-Alerts)
 *
 * Unit tests for the pure helpers. The orchestration (sendAlertForCancellation)
 * is integration-tested via the cancel route + E2E (the route is the only
 * caller, and it requires a real supabase + push service).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEDUP_WINDOW_MINUTES,
  getSlotKey,
  minutesBetween,
  shouldFireForSlot,
  formatSlotTime,
  buildLastMinutePayload,
  _clearDedupForTests,
} from '@/lib/services/last-minute-alert.service';

const NOW = new Date('2026-06-30T10:00:00.000Z');

describe('last-minute-alert.service — constants', () => {
  it('dedup window is 10 minutes (per ticket spec, prevents spam in busy clubs)', () => {
    expect(DEDUP_WINDOW_MINUTES).toBe(10);
  });
});

describe('last-minute-alert.service — getSlotKey', () => {
  it('joins club, court, and time with colons', () => {
    expect(getSlotKey('club-1', 'court-1', '2026-06-30T18:00:00.000Z')).toBe(
      'club-1:court-1:2026-06-30T18:00:00.000Z'
    );
  });

  it('produces unique keys for different (club, court, time) tuples', () => {
    const k1 = getSlotKey('club-1', 'court-1', '2026-06-30T18:00:00.000Z');
    const k2 = getSlotKey('club-1', 'court-2', '2026-06-30T18:00:00.000Z');
    const k3 = getSlotKey('club-1', 'court-1', '2026-06-30T19:00:00.000Z');
    expect(new Set([k1, k2, k3]).size).toBe(3);
  });
});

describe('last-minute-alert.service — minutesBetween', () => {
  it('returns positive minutes for a past timestamp', () => {
    const from = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();
    expect(minutesBetween(from, NOW)).toBeCloseTo(5, 5);
  });

  it('returns negative minutes for a future timestamp', () => {
    const from = new Date(NOW.getTime() + 3 * 60 * 1000).toISOString();
    expect(minutesBetween(from, NOW)).toBeCloseTo(-3, 5);
  });

  it('handles zero delta', () => {
    expect(minutesBetween(NOW.toISOString(), NOW)).toBe(0);
  });

  it('handles fractional minutes', () => {
    const from = new Date(NOW.getTime() - 90 * 1000).toISOString();
    expect(minutesBetween(from, NOW)).toBeCloseTo(1.5, 5);
  });
});

describe('last-minute-alert.service — shouldFireForSlot', () => {
  beforeEach(() => {
    _clearDedupForTests();
  });

  it('fires when dedup map is empty', () => {
    const map = new Map<string, Date>();
    expect(shouldFireForSlot('k', NOW, map)).toEqual({ fire: true });
  });

  it('fires when last alert is older than the dedup window', () => {
    const map = new Map<string, Date>();
    const oldFire = new Date(NOW.getTime() - (DEDUP_WINDOW_MINUTES + 1) * 60 * 1000);
    map.set('k', oldFire);
    expect(shouldFireForSlot('k', NOW, map)).toEqual({ fire: true });
  });

  it('does not fire when last alert is within the dedup window', () => {
    const map = new Map<string, Date>();
    const recentFire = new Date(NOW.getTime() - 3 * 60 * 1000); // 3 min ago
    map.set('k', recentFire);
    expect(shouldFireForSlot('k', NOW, map)).toEqual({ fire: false, reason: 'slot' });
  });

  it('fires on the exact boundary (last fire was exactly DEDUP_WINDOW_MINUTES ago)', () => {
    const map = new Map<string, Date>();
    const boundary = new Date(NOW.getTime() - DEDUP_WINDOW_MINUTES * 60 * 1000);
    map.set('k', boundary);
    expect(shouldFireForSlot('k', NOW, map)).toEqual({ fire: true });
  });

  it('isolates by slot key (different slot with recent fire still fires)', () => {
    const map = new Map<string, Date>();
    map.set('slot-A', new Date(NOW.getTime() - 1 * 60 * 1000));
    expect(shouldFireForSlot('slot-B', NOW, map)).toEqual({ fire: true });
  });
});

describe('last-minute-alert.service — formatSlotTime', () => {
  it('formats a UTC time as German day + time', () => {
    // 2026-06-30 is a Tuesday in DE; de-DE Intl adds a comma after the weekday
    // abbreviation (e.g. "Di., 30.06. 20:00"). Regex tolerates the optional comma.
    const out = formatSlotTime('2026-06-30T18:00:00.000Z');
    expect(out).toMatch(/Di\.,?\s+30\.06\.\s+20:00/); // CEST = UTC+2 in June
  });
});

describe('last-minute-alert.service — buildLastMinutePayload', () => {
  it('uses the court name in the body', () => {
    const payload = buildLastMinutePayload('Platz 1', '2026-06-30T18:00:00.000Z', '');
    expect(payload.body).toContain('Platz 1');
  });

  it('mentions the slot time in the body', () => {
    const payload = buildLastMinutePayload('Platz 1', '2026-06-30T18:00:00.000Z', '');
    expect(payload.body).toMatch(/Di\.,?\s+30\.06\.\s+20:00/);
  });

  it('uses "Platz frei!" title with court emoji', () => {
    const payload = buildLastMinutePayload('Platz 1', '2026-06-30T18:00:00.000Z', '');
    expect(payload.title).toBe('🏸 Platz frei!');
  });

  it('points to /bookings when appUrl is empty', () => {
    const payload = buildLastMinutePayload('Platz 1', '2026-06-30T18:00:00.000Z', '');
    expect(payload.url).toBe('/bookings');
  });

  it('prepends appUrl to /bookings', () => {
    const payload = buildLastMinutePayload(
      'Platz 1',
      '2026-06-30T18:00:00.000Z',
      'https://app.swingz.de'
    );
    expect(payload.url).toBe('https://app.swingz.de/bookings');
  });

  it('tags the notification for native grouping', () => {
    const payload = buildLastMinutePayload('Platz 1', '2026-06-30T18:00:00.000Z', '');
    expect(payload.tag).toBe('last-minute-Platz 1-2026-06-30T18:00:00.000Z');
  });

  it('includes type:last_minute in data for client-side routing', () => {
    const payload = buildLastMinutePayload('Platz 1', '2026-06-30T18:00:00.000Z', '');
    expect(payload.data?.type).toBe('last_minute');
    expect(payload.data?.courtName).toBe('Platz 1');
    expect(payload.data?.sessionStartTime).toBe('2026-06-30T18:00:00.000Z');
  });
});

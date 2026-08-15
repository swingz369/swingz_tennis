import { describe, it, expect, vi, afterEach } from 'vitest';
import { seasonWeekProgress } from '@/components/admin/season-progress-card';

/** Saisonverlauf-Rechnung der Dashboard-Karte — reine Datumsmathematik. */
describe('seasonWeekProgress', () => {
  afterEach(() => vi.useRealTimers());

  const withNow = (iso: string, fn: () => void) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
    fn();
    vi.useRealTimers();
  };

  it('gibt null ohne verwertbare Datumsangaben', () => {
    expect(seasonWeekProgress(null, '2026-12-01')).toBeNull();
    expect(seasonWeekProgress('2026-10-01', null)).toBeNull();
    expect(seasonWeekProgress('kaputt', '2026-12-01')).toBeNull();
    // Ende vor Beginn
    expect(seasonWeekProgress('2026-12-01', '2026-10-01')).toBeNull();
  });

  it('zählt Wochen ab Saisonbeginn und bleibt in der Spanne', () => {
    withNow('2026-10-15T12:00:00Z', () => {
      const p = seasonWeekProgress('2026-10-01', '2026-12-24')!;
      expect(p.current).toBe(3);
      expect(p.total).toBe(12);
      expect(p.pct).toBeGreaterThan(0);
      expect(p.pct).toBeLessThan(100);
    });
  });

  it('deckelt vor Beginn und nach Ende', () => {
    withNow('2026-09-01T00:00:00Z', () => {
      const p = seasonWeekProgress('2026-10-01', '2026-12-24')!;
      expect(p.current).toBe(1);
      expect(p.pct).toBe(0);
    });
    withNow('2027-01-10T00:00:00Z', () => {
      const p = seasonWeekProgress('2026-10-01', '2026-12-24')!;
      expect(p.current).toBe(p.total);
      expect(p.pct).toBe(100);
      expect(p.label).toBe('Saison beendet');
    });
  });
});

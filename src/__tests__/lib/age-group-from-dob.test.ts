import { describe, it, expect, vi, afterEach } from 'vitest';
import { ageGroupFromDateOfBirth } from '@/app/(protected)/member/preferences/page';

/**
 * Die Altersgruppe entscheidet, ob die Clustering-Engine ein Mitglied als
 * minderjährig behandelt und ihm nur Slots ab 14:00 zuweist
 * (`lib/season-planning/clustering-engine.ts:662`). Ein falsches 'senior'
 * setzt Schulkinder in Vormittagstraining.
 */
describe('ageGroupFromDateOfBirth', () => {
  afterEach(() => vi.useRealTimers());

  const at = (today: string, dob: string | null | undefined) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(today));
    return ageGroupFromDateOfBirth(dob);
  };

  it('behandelt fehlende oder unlesbare Geburtsdaten als erwachsen', () => {
    expect(at('2026-08-13', null)).toBe('senior');
    expect(at('2026-08-13', undefined)).toBe('senior');
    expect(at('2026-08-13', 'kein Datum')).toBe('senior');
  });

  it('erkennt Kinder', () => {
    expect(at('2026-08-13', '2015-06-01')).toBe('kids');
  });

  it('erkennt Erwachsene', () => {
    expect(at('2026-08-13', '1990-03-20')).toBe('senior');
  });

  it('zählt den Geburtstag selbst schon als volljährig', () => {
    expect(at('2026-08-13', '2008-08-13')).toBe('senior');
  });

  it('behandelt den Tag vor dem 18. Geburtstag noch als Kind', () => {
    expect(at('2026-08-13', '2008-08-14')).toBe('kids');
  });
});

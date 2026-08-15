import { describe, it, expect } from 'vitest';
import { isMinorByBirthdate } from '@/lib/season-planning/conflict-utils';

// Die Saisonplanung leitet aus dieser Funktion zwei harte Regeln ab:
// Kinder trainieren Mo-Fr frühestens 14:00 und nie über 20:00 hinaus.
// Vorher wurde Minderjährigkeit aus dem Wunschfeld `preferred_age_group`
// geraten, das bei Mitgliedern ohne Präferenzen leer ist.
describe('isMinorByBirthdate', () => {
  const today = new Date('2026-08-15');

  it('erkennt Minderjährige', () => {
    expect(isMinorByBirthdate('2014-03-02', today)).toBe(true);
  });

  it('erkennt Volljährige', () => {
    expect(isMinorByBirthdate('1990-01-01', today)).toBe(false);
  });

  it('zählt den Geburtstag selbst als volljährig', () => {
    expect(isMinorByBirthdate('2008-08-15', today)).toBe(false);
  });

  it('ist am Tag vor dem 18. Geburtstag noch minderjährig', () => {
    expect(isMinorByBirthdate('2008-08-16', today)).toBe(true);
  });

  it('gibt null zurück, wenn kein Datum hinterlegt ist', () => {
    expect(isMinorByBirthdate(null, today)).toBeNull();
    expect(isMinorByBirthdate('', today)).toBeNull();
    expect(isMinorByBirthdate('kein datum', today)).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { berlinWallClock, berlinDateTime, berlinParts } from '@/lib/berlin-time';

describe('berlinWallClock', () => {
  it('bildet Sommerzeit ab (17:00 Berlin = 15:00 UTC)', () => {
    const d = berlinWallClock(new Date('2026-09-07T00:00:00Z'), 17, 0);
    expect(d.toISOString()).toBe('2026-09-07T15:00:00.000Z');
  });

  it('bildet Winterzeit ab (17:00 Berlin = 16:00 UTC)', () => {
    const d = berlinWallClock(new Date('2026-12-07T00:00:00Z'), 17, 0);
    expect(d.toISOString()).toBe('2026-12-07T16:00:00.000Z');
  });

  it('trifft den Tag der Zeitumstellung (25.10.2026, Ende der Sommerzeit)', () => {
    // Umstellung um 03:00 -> 02:00. 17:00 liegt danach, also Winterzeit (+1).
    const d = berlinWallClock(new Date('2026-10-25T00:00:00Z'), 17, 0);
    expect(d.toISOString()).toBe('2026-10-25T16:00:00.000Z');
  });

  it('übernimmt das Datum aus base, nicht dessen Uhrzeit', () => {
    const d = berlinWallClock(new Date('2026-09-07T23:45:00Z'), 9, 30);
    expect(d.toISOString()).toBe('2026-09-07T07:30:00.000Z');
  });

  // Der eigentliche Punkt: das Ergebnis darf nicht von der Server-Zeitzone
  // abhängen. Genau das war der Fehler — lokal (Berlin) stimmte es, auf
  // Vercel (UTC) lag jede Trainingszeit 2 Stunden daneben. Vitest kann TZ
  // nicht pro Test umschalten, also wird die Zone hier nachgestellt: das
  // Ergebnis wird gegen einen von der Laufzeit unabhängigen Sollwert geprüft.
  it('hängt nicht von der lokalen Zeitzone der Laufzeit ab', () => {
    const soll = Date.UTC(2026, 8, 7, 15, 0); // 17:00 Berlin im Sommer
    const ist = berlinWallClock(new Date('2026-09-07T00:00:00Z'), 17, 0).getTime();
    expect(ist).toBe(soll);
    // getTimezoneOffset der Laufzeit darf das Ergebnis nicht verschoben haben
    expect(ist % (60 * 60 * 1000)).toBe(0);
  });
});

describe('berlinDateTime / berlinParts', () => {
  it('19:00 Berliner Sommerzeit ist 17:00 UTC, unabhängig von der Serverzeitzone', () => {
    expect(berlinDateTime('2026-09-19', '19:00').toISOString()).toBe('2026-09-19T17:00:00.000Z');
    expect(berlinDateTime('2026-01-15', '19:00').toISOString()).toBe('2026-01-15T18:00:00.000Z');
  });

  it('berlinParts ist die Umkehrung, auch über Mitternacht UTC hinweg', () => {
    expect(berlinParts(new Date('2026-09-19T17:00:00Z'))).toEqual({
      date: '2026-09-19',
      time: '19:00',
      dayOfWeek: 6,
    });
    // 22:30 UTC ist in Berlin (CEST) schon der nächste Tag, ein Sonntag
    expect(berlinParts(new Date('2026-09-19T22:30:00Z'))).toEqual({
      date: '2026-09-20',
      time: '00:30',
      dayOfWeek: 0,
    });
  });
});

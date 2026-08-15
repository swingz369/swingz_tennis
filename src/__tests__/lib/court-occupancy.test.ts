import { describe, it, expect } from 'vitest';
import { buildOccupancyGrid, currentWeekRange } from '@/lib/court-occupancy';

// 2026-08-10 ist ein Montag. Alle Timestamps hier in UTC angegeben, damit
// der Test die Zeitzonen-Umrechnung tatsächlich prüft und nicht umgeht.
describe('buildOccupancyGrid', () => {
  it('sortiert nach Europe/Berlin, nicht nach UTC', () => {
    // 2026-08-10T22:30Z = Dienstag 00:30 MESZ → ausserhalb 07–22 Uhr,
    // muss verworfen werden. Nach UTC wäre es Montag 22 Uhr und würde
    // fälschlich in der Montagszeile landen.
    const grid = buildOccupancyGrid([{ start: '2026-08-10T22:30:00Z', courtId: 'c1' }], 4);
    expect(grid.isEmpty).toBe(true);
  });

  it('zählt denselben Platz in derselben Stunde nur einmal', () => {
    // 2026-08-10T16:00Z = Montag 18:00 MESZ. Session + Buchung auf Platz c1.
    const grid = buildOccupancyGrid(
      [
        { start: '2026-08-10T16:00:00Z', courtId: 'c1' },
        { start: '2026-08-10T16:30:00Z', courtId: 'c1' },
        { start: '2026-08-10T16:15:00Z', courtId: 'c2' },
      ],
      4
    );
    const hourIndex = grid.hours.indexOf(18);
    expect(grid.days[0].label).toBe('Mo');
    expect(grid.days[0].cells[hourIndex]).toBe(0.5); // 2 von 4 Plätzen, nicht 3
  });

  it('ignoriert Slots ohne Platz und teilt nie durch 0', () => {
    const grid = buildOccupancyGrid([{ start: '2026-08-10T16:00:00Z', courtId: null }], 0);
    expect(grid.isEmpty).toBe(true);
    expect(grid.days.every((d) => d.cells.every((c) => c === 0))).toBe(true);
  });

  it('deckelt bei 1, wenn mehr Plätze belegt sind als aktiv gemeldet', () => {
    const grid = buildOccupancyGrid(
      [
        { start: '2026-08-10T16:00:00Z', courtId: 'c1' },
        { start: '2026-08-10T16:00:00Z', courtId: 'c2' },
      ],
      1
    );
    expect(grid.days[0].cells[grid.hours.indexOf(18)]).toBe(1);
  });
});

describe('currentWeekRange', () => {
  it('startet montags, auch wenn heute Sonntag ist', () => {
    // 2026-08-16 ist ein Sonntag.
    const { from, to } = currentWeekRange(new Date(2026, 7, 16, 15, 0, 0));
    expect(new Date(from).getDay()).toBe(1); // Montag
    expect(new Date(from).getDate()).toBe(10);
    expect(new Date(to).getDate()).toBe(17);
  });
});

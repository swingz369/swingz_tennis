/**
 * Der Export ist der Ausstiegsweg aus SwingZ (PRODUKTIONSREIFE.md 3.5). Er
 * ist erst dann einer, wenn die Datei sich in deutschem Excel korrekt öffnet
 * — Semikolon, BOM, verdoppelte Anführungszeichen.
 */
import { describe, it, expect } from 'vitest';
import { toCsv } from '@/lib/csv';

describe('toCsv', () => {
  it('trennt mit Semikolon und beginnt mit dem BOM', () => {
    const csv = toCsv([{ nr: 42, name: 'Müller' }]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('"nr";"name"');
    expect(csv).toContain('"42";"Müller"');
  });

  it('nutzt die angegebenen Überschriften und Reihenfolge', () => {
    const csv = toCsv(
      [{ b: 2, a: 1 }],
      [
        ['a', 'Erste'],
        ['b', 'Zweite'],
      ]
    );
    expect(csv.split('\r\n')[0]).toBe('﻿"Erste";"Zweite"');
    expect(csv.split('\r\n')[1]).toBe('"1";"2"');
  });

  it('verschiebt keine Spalten, wenn ein Wert ein Semikolon enthält', () => {
    const csv = toCsv([{ notiz: 'Hallo; Welt', ok: 'ja' }]);
    expect(csv.split('\r\n')[1]).toBe('"Hallo; Welt";"ja"');
  });

  it('verdoppelt Anführungszeichen im Wert', () => {
    expect(toCsv([{ x: 'er sagte "hi"' }])).toContain('"er sagte ""hi"""');
  });

  it('schreibt leere Zellen statt "null" oder "undefined" — und behält die 0', () => {
    const csv = toCsv([{ a: null, b: undefined, c: 0 }]);
    expect(csv.split('\r\n')[1]).toBe(';;"0"');
  });
});

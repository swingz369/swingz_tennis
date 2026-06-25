import { describe, it, expect } from 'vitest';
import { escapeCsvCell } from '@/lib/csv-export';

describe('escapeCsvCell — DE-CSV (Semikolon-getrennt, RFC 4180 Quotes)', () => {
  it('null wird zu leerem String', () => {
    expect(escapeCsvCell(null)).toBe('');
  });

  it('undefined wird zu leerem String', () => {
    expect(escapeCsvCell(undefined)).toBe('');
  });

  it('leerer String bleibt leer', () => {
    expect(escapeCsvCell('')).toBe('');
  });

  it('Plain ASCII wird unverändert zurückgegeben', () => {
    expect(escapeCsvCell('TC Rheinland')).toBe('TC Rheinland');
    expect(escapeCsvCell('Heim')).toBe('Heim');
  });

  it('Zahl wird zu String konvertiert', () => {
    expect(escapeCsvCell(42)).toBe('42');
    expect(escapeCsvCell(3.14)).toBe('3.14');
    expect(escapeCsvCell(0)).toBe('0');
  });

  it('Negativ-Zahl bleibt erhalten', () => {
    expect(escapeCsvCell(-100)).toBe('-100');
  });

  it('Boolean wird zu "true"/"false"', () => {
    expect(escapeCsvCell(true)).toBe('true');
    expect(escapeCsvCell(false)).toBe('false');
  });

  it('Semikolon triggert Quoting', () => {
    expect(escapeCsvCell('Heim;Gast')).toBe('"Heim;Gast"');
  });

  it('Doppeltes Hochkomma wird verdoppelt + Zelle gequotet (RFC 4180)', () => {
    // Original `"` → `""` IN der gequoteten Zelle
    expect(escapeCsvCell('Sag "Hallo"')).toBe('"Sag ""Hallo"""');
  });

  it('Newline (\\n) triggert Quoting', () => {
    expect(escapeCsvCell('Zeile1\nZeile2')).toBe('"Zeile1\nZeile2"');
  });

  it('Carriage Return (\\r) triggert Quoting', () => {
    expect(escapeCsvCell('Zeile1\r\nZeile2')).toBe('"Zeile1\r\nZeile2"');
  });

  it('Nur \\r (ohne \\n) triggert ebenfalls Quoting', () => {
    expect(escapeCsvCell('a\rb')).toBe('"a\rb"');
  });

  it('Kombination: alle Sonderzeichen gleichzeitig', () => {
    expect(escapeCsvCell('a;b"c\nd')).toBe('"a;b""c\nd"');
  });

  it('Deutsche Umlaute bleiben unverändert (UTF-8 Passthrough)', () => {
    expect(escapeCsvCell('Größe')).toBe('Größe');
    expect(escapeCsvCell('Müller-Lüdenscheidt')).toBe('Müller-Lüdenscheidt');
    expect(escapeCsvCell('äöüÄÖÜß')).toBe('äöüÄÖÜß');
  });

  it('Datum-String wird nicht escaped', () => {
    expect(escapeCsvCell('15.06.2026')).toBe('15.06.2026');
  });

  it('DD.MM.YYYY mit Semikolon → CSV-Risiko erkannt + gequotet', () => {
    expect(escapeCsvCell('15.06.2026; Heim')).toBe('"15.06.2026; Heim"');
  });

  it('Edge: nur Hochkomma (nichts anderes) → """"', () => {
    // Quote-Logik: `"` wird zu `""` → dann gewrapped in Quotes → `"""`
    expect(escapeCsvCell('"')).toBe('""""');
  });

  it('Edge: Mehrere Hochkommata → jedes verdoppelt', () => {
    expect(escapeCsvCell('"""')).toBe('""""""""');
  });

  it('Edge: Zahl 0 wird zu "0" (nicht zu "")', () => {
    // Verhindert Datenverlust bei numerischen 0-Werten (z.B. score_away)
    expect(escapeCsvCell(0)).toBe('0');
  });

  it('Edge: Object wird zu "[object Object]" ohne Quoting', () => {
    // Documented behavior: String() coercion ohne Detection
    expect(escapeCsvCell({ foo: 'bar' })).toBe('[object Object]');
  });

  it('Edge: Array wird zu Komma-getrenntem String', () => {
    // String([1,2,3]) = '1,2,3'
    expect(escapeCsvCell([1, 2, 3])).toBe('1,2,3');
  });

  it('Edge: Date wird zu locale-string (kann Sonderzeichen enthalten) → NICHT gequotet weil aktuelle locale-de-DE kein Semikolon erzeugt', () => {
    // Date.toString() enthält z.B. 'Mon Jun 15 2026 ...' — keine ';' / '"' / '\n' / '\r' Zeichen
    expect(escapeCsvCell(new Date('2026-06-15T12:00:00Z'))).not.toContain(';');
  });

  it('Real-World Medenspiel-Zeile: Heim, Gast, Punkte, Bemerkung mit Hochkomma', () => {
    // "Bemerkung mit "Anführungszeichen"\nund Zeilenumbruch"
    expect(escapeCsvCell('"Bemerkung mit "Anführungszeichen"\nund Zeilenumbruch"')).toBe(
      '"""Bemerkung mit ""Anführungszeichen""\nund Zeilenumbruch"""'
    );
  });

  it('NaN wird zu "NaN" (kein Sonderzeichen, bleibt unverändert)', () => {
    expect(escapeCsvCell(NaN)).toBe('NaN');
  });

  it('BigInt wird per String() konvertiert', () => {
    expect(escapeCsvCell(BigInt(100))).toBe('100');
  });

  it('Symbol wird zu "Symbol(...)"', () => {
    expect(escapeCsvCell(Symbol('test'))).toBe('Symbol(test)');
  });
});

/**
 * CSV für deutsche Tabellenkalkulationen.
 *
 * Grund: Die Exporte schrieben Komma-getrennte Dateien ohne Byte Order Mark.
 * Excel in deutscher Regionaleinstellung liest Semikolon als Trennzeichen und
 * ohne BOM nicht UTF-8 — beides zusammen ergibt eine Datei, in der alles in
 * einer Spalte steht und jeder Umlaut kaputt ist. Ein Verein, der seine Daten
 * nicht wieder herausbekommt, kauft nicht (PRODUKTIONSREIFE.md 3.5).
 */

/** Trennzeichen, das deutsches Excel erwartet. */
const SEP = ';';
/** Ohne BOM interpretiert Excel die Datei als Windows-1252. */
const BOM = '﻿';

function cell(value: unknown): string {
  if (value == null) return '';
  const text = value instanceof Date ? (value.toISOString().split('T')[0] ?? '') : String(value);
  // Anführungszeichen verdoppeln; gequotet wird immer, damit ein Semikolon
  // oder Zeilenumbruch im Wert die Spalten nicht verschiebt.
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Baut eine CSV-Datei aus Objekten.
 *
 * @param rows    Datenzeilen. Leer → nur die Kopfzeile (falls `columns` gesetzt).
 * @param columns Spalten in gewünschter Reihenfolge als [Schlüssel, Überschrift].
 *                Ohne Angabe werden die Schlüssel der ersten Zeile verwendet.
 */
export function toCsv(
  rows: ReadonlyArray<Record<string, unknown>>,
  columns?: ReadonlyArray<readonly [key: string, label: string]>
): string {
  const cols =
    columns ?? Object.keys(rows[0] ?? {}).map((k) => [k, k] as readonly [string, string]);
  if (cols.length === 0) return BOM;

  const lines = [cols.map(([, label]) => cell(label)).join(SEP)];
  for (const row of rows) {
    lines.push(cols.map(([key]) => cell(row[key])).join(SEP));
  }
  // CRLF: Excel stolpert unter Windows sonst über einzelne Zeilenumbrüche.
  return BOM + lines.join('\r\n');
}

/** Header für eine CSV-Antwort. `filename` ohne Endung. */
export function csvHeaders(filename: string): Record<string, string> {
  return {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}.csv"`,
    'Cache-Control': 'no-store',
  };
}

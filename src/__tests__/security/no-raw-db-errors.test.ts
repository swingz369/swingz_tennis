/**
 * Wächter gegen durchgereichte Roh-Fehlermeldungen (PRODUKTIONSREIFE.md 1.2).
 *
 * Ein 500er lieferte einmal das komplette Drizzle-Statement mit Tabellen- und
 * Spaltennamen an den Browser. Für den Nutzer wertlos, für einen Angreifer
 * eine Landkarte. Die Regel steht seit jeher in lib/api-error.ts — sie wurde
 * trotzdem an einem Dutzend Stellen gebrochen, weil niemand sie geprüft hat.
 *
 * Der Test sucht nach `.message` einer Fehlervariable in einem
 * Antwort-Objekt. Log-Aufrufe sind ausgenommen: dort *gehört* die
 * Originalmeldung hin.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const API_ROOT = join(process.cwd(), 'app', 'api');

/** `.message` einer Fehlervariable — nicht jedes beliebige `.message`. */
const ERROR_MESSAGE = /\b(\w*[eE]rr(or)?\w*)(\?)?\.message\b/;
/** Der Wert landet in einem Antwort-Objekt. */
const IN_RESPONSE = /(\berror:|\bmessage:|NextResponse\.json\(|errorResponse\()/;
/** Hier gehört die Originalmeldung hin. */
const IS_LOG = /\blog\.(error|warn|info|debug)\b/;

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) routeFiles(full, out);
    else if (entry.name === 'route.ts') out.push(full);
  }
  return out;
}

describe('API-Routen geben keine rohen Fehlermeldungen heraus', () => {
  it('kein `error.message` in einem Antwort-Objekt', () => {
    const findings: string[] = [];

    for (const file of routeFiles(API_ROOT)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        if (!ERROR_MESSAGE.test(line)) return;
        if (!IN_RESPONSE.test(line)) return;
        // Log-Aufruf — kann sich über mehrere Zeilen ziehen.
        const context = lines.slice(Math.max(0, i - 3), i + 1).join('\n');
        if (IS_LOG.test(context)) return;
        findings.push(`${file.replace(process.cwd() + '/', '')}:${i + 1}  ${line.trim()}`);
      });
    }

    expect(
      findings,
      `Rohe Fehlermeldung in der Antwort. Nutze stattdessen einen deutschen ` +
        `Text oder safeErrorMessage() aus lib/api-error.ts:\n${findings.join('\n')}`
    ).toEqual([]);
  });
});

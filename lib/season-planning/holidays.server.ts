/**
 * Schulferien aus der Datenbank statt aus der hartkodierten Liste.
 *
 * `lib/season-planning/holidays.ts` trägt die Ferien als Konstante im Code — beim
 * QA-Durchlauf am 12.08.2026 waren das die Termine des Schuljahrs **2025/26**.
 * Für eine Saison 2026/27 passte kein einziger Eintrag, also wurde kein Termin
 * ausgelassen: Die Gruppen hatten Training an Heiligabend und Silvester, und die
 * Abrechnung stellte es in Rechnung.
 *
 * Die gepflegte Tabelle `school_holidays` ist jetzt die einzige Quelle (213
 * Einträge, alle 16 Bundesländer; die brauchbaren Termine der alten Konstante
 * wurden am 12.08.2026 dorthin übernommen). Fehlt für ein Bundesland ein
 * Zeitraum, wird durchgeplant — dann ist die Tabelle zu pflegen, nicht der Code.
 *
 * Nur serverseitig verwendbar (DB-Zugriff). `holidays.ts` bleibt bewusst rein.
 */
import { systemDb } from '@/infrastructure/db';
import { BUNDESLAND_NAMES, type Holiday } from './holidays';
import { createLogger } from '@/lib/logger';

const log = createLogger('season-planning:holidays');

/**
 * Ferien eines Bundeslands. Erwartet den 2-Buchstaben-Code (`resolveBundeslandCode`).
 * Liefert eine leere Liste, wenn nichts hinterlegt ist oder die Abfrage scheitert —
 * geplant wird dann ohne Ferienpause, und die Warnung steht im Log.
 */
export async function loadHolidaysForState(stateCode: string): Promise<Holiday[]> {
  const bundeslandName = BUNDESLAND_NAMES[stateCode];
  if (!bundeslandName) {
    log.warn('Unbekannter Bundesland-Code — Planung ohne Ferien', { stateCode });
    return [];
  }

  try {
    // Referenzdaten ohne Mandantenbezug, aufgerufen aus Planungs-Lib ohne Auth-Kontext.
    const { data, error } = await systemDb('Schulferien: Referenzdaten ohne Mandantenbezug')
      .from('school_holidays')
      .select('name, start_date, end_date')
      .eq('bundesland', bundeslandName);
    if (error) throw new Error(error.message);
    const rows = data ?? [];

    if (rows.length === 0) {
      log.warn('Keine Ferien in school_holidays hinterlegt — Planung ohne Ferienpause', {
        stateCode,
        bundeslandName,
      });
    }

    return rows.map((r) => ({ name: r.name, start: r.start_date, end: r.end_date }));
  } catch (err) {
    log.error(
      'Ferien konnten nicht geladen werden — Planung ohne Ferienpause',
      err instanceof Error ? err : undefined
    );
    return [];
  }
}

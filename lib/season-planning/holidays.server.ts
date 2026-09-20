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
 * Fehlen Daten (leere Tabelle, z. B. frische lokale DB, oder alle Einträge
 * abgelaufen), holt `loadKind` sie einmalig von openholidaysapi.org und legt sie
 * in `school_holidays` ab. Damit muss niemand Ferien oder Feiertage pflegen.
 * `kind = 'school'` sind Ferienblöcke (wochenweise Pause), `kind = 'public'`
 * gesetzliche Feiertage (nur der Tag selbst).
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
type Kind = 'school' | 'public';

const OPEN_HOLIDAYS = 'https://openholidaysapi.org';

/**
 * Lädt Ferien bzw. Feiertage des laufenden und nächsten Jahres und schreibt sie
 * per Upsert in `school_holidays`. Wirft nicht — ein Ausfall der API darf die
 * Planung nicht blockieren.
 */
async function syncFromOpenHolidays(stateCode: string, bundesland: string, kind: Kind) {
  const year = new Date().getFullYear();
  const endpoint = kind === 'school' ? 'SchoolHolidays' : 'PublicHolidays';
  const url =
    `${OPEN_HOLIDAYS}/${endpoint}?countryIsoCode=DE&subdivisionCode=DE-${stateCode}` +
    `&validFrom=${year}-01-01&validTo=${year + 1}-12-31&languageIsoCode=DE`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = (await res.json()) as Array<{
      startDate: string;
      endDate: string;
      name: Array<{ language: string; text: string }>;
    }>;
    const rows = items.map((i) => ({
      bundesland,
      kind,
      name: i.name.find((n) => n.language === 'DE')?.text ?? i.name[0]?.text ?? 'Ferien',
      start_date: i.startDate,
      end_date: i.endDate,
      year: Number(i.startDate.slice(0, 4)),
    }));
    if (rows.length === 0) return;
    const { error } = await systemDb('Schulferien: Referenzdaten ohne Mandantenbezug')
      .from('school_holidays')
      .upsert(rows, { onConflict: 'bundesland,kind,name,start_date' });
    if (error) throw new Error(error.message);
    log.info('Feiertage/Ferien synchronisiert', { stateCode, kind, count: rows.length });
  } catch (err) {
    log.error(
      'Sync von openholidaysapi.org fehlgeschlagen',
      err instanceof Error ? err : undefined
    );
  }
}

async function loadKind(stateCode: string, kind: Kind): Promise<Holiday[]> {
  const bundeslandName = BUNDESLAND_NAMES[stateCode];
  if (!bundeslandName) {
    log.warn('Unbekannter Bundesland-Code — Planung ohne Ferien', { stateCode });
    return [];
  }

  const read = async () => {
    // Referenzdaten ohne Mandantenbezug, aufgerufen aus Planungs-Lib ohne Auth-Kontext.
    const { data, error } = await systemDb('Schulferien: Referenzdaten ohne Mandantenbezug')
      .from('school_holidays')
      .select('name, start_date, end_date')
      .eq('bundesland', bundeslandName)
      .eq('kind', kind);
    if (error) throw new Error(error.message);
    return data ?? [];
  };

  try {
    let rows = await read();
    const today = new Date().toISOString().slice(0, 10);
    // ponytail: "nichts in der Zukunft" als Trigger — reicht, weil der Sync zwei Jahre vorlädt.
    if (!rows.some((r) => r.end_date >= today)) {
      await syncFromOpenHolidays(stateCode, bundeslandName, kind);
      rows = await read();
    }
    if (rows.length === 0) {
      log.warn('Keine Ferien/Feiertage hinterlegt — Planung ohne Pause', { stateCode, kind });
    }
    return rows.map((r) => ({ name: r.name, start: r.start_date, end: r.end_date }));
  } catch (err) {
    log.error(
      'Ferien konnten nicht geladen werden — Planung ohne Pause',
      err instanceof Error ? err : undefined
    );
    return [];
  }
}

/** Ferienblöcke eines Bundeslands (2-Buchstaben-Code, `resolveBundeslandCode`). */
export const loadHolidaysForState = (stateCode: string) => loadKind(stateCode, 'school');

/** Gesetzliche Feiertage — nur tagesgenau verwenden, nie als Ferienwoche. */
export const loadPublicHolidaysForState = (stateCode: string) => loadKind(stateCode, 'public');

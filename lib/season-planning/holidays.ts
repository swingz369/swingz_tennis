// Hilfsfunktionen rund um Schulferien für die Saisonplanung.
//
// Die Ferientermine selbst standen bis zum 12.08.2026 als Konstante in dieser
// Datei — über 300 Zeilen KMK-Daten, die jemand jedes Jahr hätte nachpflegen
// müssen. Genau das war nicht passiert: Für Nordrhein-Westfalen fehlten 2026
// ausgerechnet Herbst- und Weihnachtsferien, wodurch die Saisonplanung
// Trainingstermine auf den 24. und 31. Dezember legte und in Rechnung stellte.
// Fehlende Ferien fallen niemandem auf, deshalb blieb es unbemerkt.
//
// Quelle ist jetzt ausschließlich die Tabelle `school_holidays`; geladen wird sie
// über `loadHolidaysForState()` aus `holidays.server.ts`. Diese Datei bleibt
// bewusst frei von Datenbankzugriffen, damit sie auch clientseitig nutzbar ist.

export interface Holiday {
  name: string;
  start: string; // ISO date YYYY-MM-DD
  end: string;
}

export interface WeekInfo {
  monday: string; // ISO date of Monday
  isHolidayWeek: boolean;
  holidayNames: string[];
}

/**
 * Bundesland display names.
 */
export const BUNDESLAND_NAMES: Record<string, string> = {
  BW: 'Baden-Württemberg',
  BY: 'Bayern',
  BE: 'Berlin',
  BB: 'Brandenburg',
  HB: 'Bremen',
  HH: 'Hamburg',
  HE: 'Hessen',
  MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen',
  NW: 'Nordrhein-Westfalen',
  RP: 'Rheinland-Pfalz',
  SL: 'Saarland',
  SN: 'Sachsen',
  ST: 'Sachsen-Anhalt',
  SH: 'Schleswig-Holstein',
  TH: 'Thüringen',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Given any date, returns the Monday of that ISO week.
 */
export function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Sunday = 0 → Monday -6
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Checks if a given week (identified by its Monday) overlaps with any holidays.
 * Returns true if at least one holiday day falls within the week.
 */
export function isHolidayWeek(monday: string, holidays: Holiday[]): boolean {
  const mon = new Date(monday);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  const sunStr = sun.toISOString().slice(0, 10);

  for (const h of holidays) {
    // Holiday overlaps with [monday, sunday]
    if (h.start <= sunStr && h.end >= monday) return true;
  }
  return false;
}

/**
 * Returns holiday names that overlap with the given week.
 */
export function getHolidayNamesForWeek(monday: string, holidays: Holiday[]): string[] {
  const mon = new Date(monday);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  const sunStr = sun.toISOString().slice(0, 10);

  return holidays.filter((h) => h.start <= sunStr && h.end >= monday).map((h) => h.name);
}

/**
 * Generates a list of WeekInfo objects for a given date range.
 * Each week is identified by its Monday.
 */
export function getWeeks(startDate: string, endDate: string, holidays: Holiday[]): WeekInfo[] {
  const weeks: WeekInfo[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const cursor = new Date(getMonday(start));

  while (cursor <= end) {
    const monday = cursor.toISOString().slice(0, 10);
    const holiday = isHolidayWeek(monday, holidays);
    const names = holiday ? getHolidayNamesForWeek(monday, holidays) : [];
    weeks.push({ monday, isHolidayWeek: holiday, holidayNames: names });
    cursor.setDate(cursor.getDate() + 7);
  }

  return weeks;
}

/**
 * Returns whether a specific date falls within any holiday.
 */
export function isDateInHolidays(date: string, holidays: Holiday[]): boolean {
  for (const h of holidays) {
    if (date >= h.start && date <= h.end) return true;
  }
  return false;
}

/**
 * Finds the Bundesland code from a club's Bundesland setting.
 * The club.bundesland field can be a full name or 2-letter code.
 * Returns 'HE' as default fallback.
 */
/**
 * Wie `resolveBundeslandCode`, meldet aber `null` statt eines Defaults, wenn die
 * Eingabe nicht zugeordnet werden kann.
 *
 * Der Unterschied ist praktisch relevant: Aufrufer, die vor dem Hessen-Default
 * warnen wollen, verglichen die Roheingabe bisher selbst gegen die Kürzelliste —
 * und hielten damit jeden korrekt aufgelösten Klarnamen („Nordrhein-Westfalen")
 * für unbekannt. Ob die Auflösung geklappt hat, weiß nur diese Funktion.
 */
export function tryResolveBundeslandCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();

  // Direct 2-letter code match
  if (BUNDESLAND_NAMES[upper]) return upper;

  // Full name match
  for (const [code, name] of Object.entries(BUNDESLAND_NAMES)) {
    if (name.toLowerCase() === raw.trim().toLowerCase()) return code;
  }

  return null;
}

export function resolveBundeslandCode(raw: string | null | undefined): string {
  return tryResolveBundeslandCode(raw) ?? 'HE';
}

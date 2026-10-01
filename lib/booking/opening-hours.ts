/**
 * Öffnungszeiten-Enforcement für Platzbuchungen.
 *
 * `clubs.opening_hours` ist JSONB und historisch uneinheitlich belegt:
 * - Settings-Format: `{ monday: { open, close, closed? }, … }`
 * - Alt-Format (Registrierung): `{ mo: '07:00-22:00', … }`
 * - Leer: `{}` (Test-Vereine)
 *
 * Für die Buchungssperre zählt ausschließlich das `closed`-Flag im
 * Settings-Format. Fehlt es, gilt der Tag als buchbar — so bleiben Alt-Daten
 * und Vereine ohne explizite Konfiguration unverändert.
 */

// Index entspricht Date#getDay(): 0 = Sonntag … 6 = Samstag.
const DAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export const CLOSED_DAY_ERROR = 'Dieser Tag ist geschlossen — hier ist keine Buchung möglich';

export function isDayClosed(openingHours: unknown, date: Date): boolean {
  if (!openingHours || typeof openingHours !== 'object') return false;
  const day = DAY_KEYS[date.getDay()];
  const entry = (openingHours as Record<string, unknown>)[day];
  return Boolean(
    entry && typeof entry === 'object' && (entry as Record<string, unknown>).closed === true
  );
}

/** Ohne (lesbare) Öffnungszeiten gilt das Kalenderraster 08–22 Uhr. */
const DEFAULT_OPEN_HOURS = 14;

function toHours(time: unknown): number | null {
  if (typeof time !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  return m ? Number(m[1]) + Number(m[2]) / 60 : null;
}

/**
 * Öffnungsstunden eines Tages — Nenner der Platzbelegung. Liest das Settings-Format
 * (`{ open, close, closed? }`); alles andere fällt auf 08–22 Uhr zurück (das Alt-Format
 * `mo: '07:00-22:00'` kommt in keinem Verein mehr vor, Stand 01.10.2026).
 */
export function openHoursOn(openingHours: unknown, date: Date): number {
  if (!openingHours || typeof openingHours !== 'object') return DEFAULT_OPEN_HOURS;
  const entry = (openingHours as Record<string, unknown>)[DAY_KEYS[date.getDay()]];
  if (entry && typeof entry === 'object') {
    const e = entry as Record<string, unknown>;
    if (e.closed === true) return 0;
    const open = toHours(e.open);
    const close = toHours(e.close);
    if (open !== null && close !== null && close > open) return close - open;
  }
  return DEFAULT_OPEN_HOURS;
}

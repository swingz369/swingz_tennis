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

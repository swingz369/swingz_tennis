/**
 * Admin date/time formatters.
 *
 * Centralises the `Europe/Berlin` + `de-DE` locale/formatter combination
 * used by the admin dashboard chrome (`AdminPageTopbar`) and the
 * "Letzte Buchungen" widget. Using the IANA TZ explicitly avoids drift
 * between server (e.g. UTC on Vercel) and the browser locale, so the
 * Server Component renders exactly the same string the client hydrates
 * with.
 *
 * Scope: only the two formatters needed by the admin dashboard surfaces.
 * Pre-existing `Europe/Berlin` literal usages (PremiumAdminHero,
 * last-minute-alert.service) are deliberately left untouched here —
 * they use different format presets (greeting name, short weekday+time
 * for SMS) and would inflate the helper beyond the dashboard's contract.
 * If a third caller overlaps with these two presets, broaden then.
 */

const LOCALE = 'de-DE';
const TIME_ZONE = 'Europe/Berlin';
const LOCALE_OPTIONS = { locale: LOCALE, timeZone: TIME_ZONE } as const;

/**
 * Full German date for page subtitles.
 * Example: `Mittwoch, 2. Juli 2026`.
 */
export function formatAdminDateLong(input: Date): string {
  return input.toLocaleDateString('de-DE', {
    ...LOCALE_OPTIONS,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Compact German time (24 h) for booking tables.
 * Example: `17:00`.
 */
export function formatAdminTimeHM(input: string | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  return d.toLocaleTimeString('de-DE', {
    ...LOCALE_OPTIONS,
    hour: '2-digit',
    minute: '2-digit',
  });
}

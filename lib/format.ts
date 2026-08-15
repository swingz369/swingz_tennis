/**
 * lib/format.ts — Centralized Formatting Utilities
 *
 * Single source of truth for date, time, currency, and number formatting.
 * All formatters use 'de-DE' locale for consistency.
 *
 * Inspired by TSOWAPP's lib/format.ts pattern.
 */

// ── Date & Time Formatters (pre-initialized for performance) ──────────────

// Ohne explizite Zeitzone formatiert Intl in der Zeitzone der Laufzeit — und
// das sind zwei verschiedene: Server Components rendern auf Vercel in UTC,
// Client Components im Browser des Nutzers (Europe/Berlin). Dieselbe Session
// erschien dadurch server- und clientseitig mit unterschiedlicher Uhrzeit
// (im Sommer 2 h Versatz), inklusive Hydration-Mismatch. Der Verein steht
// immer in Deutschland, also ist Europe/Berlin die fachlich richtige Zone.
const TIME_ZONE = 'Europe/Berlin';

const DATE_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: TIME_ZONE,
});

const DATE_SHORT_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  timeZone: TIME_ZONE,
});

const TIME_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});

// "6. Oktober 2026" — ausgeschriebener Monat ohne Wochentag, für Detailseiten
// (Geburtsdatum, Zertifikatsdaten), wo das Datum einzeln steht statt in einer Liste.
const LONG_DATE_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: TIME_ZONE,
});

const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  month: 'long',
  year: 'numeric',
  timeZone: TIME_ZONE,
});

// "Dienstag, 6. Oktober" — für Terminlisten, in denen das Jahr aus dem Kontext
// hervorgeht. Existiert, damit solche Listen nicht auf date-fns `format()`
// ausweichen müssen, das in der Zeitzone der Laufzeit rendert (auf Vercel UTC).
const WEEKDAY_DATE_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TIME_ZONE,
});

// ── Currency & Number Formatters ──────────────────────────────────────────

const CURRENCY_FORMATTER = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

const NUMBER_FORMATTER = new Intl.NumberFormat('de-DE');

// ── Exported Helper Functions ─────────────────────────────────────────────

/** Format a date value to short weekday + date (e.g., "Mo., 01.01.2024") */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  try {
    return DATE_FORMATTER.format(new Date(value));
  } catch {
    return '—';
  }
}

/** Format to day.month only (e.g., "01.01.") */
export function formatDateShort(value: string | Date | null | undefined): string {
  if (!value) return '—';
  try {
    return DATE_SHORT_FORMATTER.format(new Date(value));
  } catch {
    return '—';
  }
}

/** Format time only (e.g., "14:30") */
export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  try {
    return TIME_FORMATTER.format(new Date(value));
  } catch {
    return '—';
  }
}

/** Format date + time (e.g., "01.01.2024, 14:30") */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  try {
    return DATE_TIME_FORMATTER.format(new Date(value));
  } catch {
    return '—';
  }
}

/** Format with written-out month (e.g., "1. Januar 2024") */
export function formatDateLong(value: string | Date | null | undefined): string {
  if (!value) return '—';
  try {
    return LONG_DATE_FORMATTER.format(new Date(value));
  } catch {
    return '—';
  }
}

/** Format month + year (e.g., "Januar 2024") */
export function formatMonthYear(value: string | Date | null | undefined): string {
  if (!value) return '—';
  try {
    return MONTH_YEAR_FORMATTER.format(new Date(value));
  } catch {
    return '—';
  }
}

/**
 * Ergänzt ein fehlendes Zeitzonen-Suffix.
 *
 * `sessions.timeslot_start/-end` sind `timestamp` OHNE Zeitzone: der Wert ist der
 * UTC-Zeitpunkt, trägt aber kein `Z`. `new Date()` liest ihn deshalb als Ortszeit —
 * ein 18:00-Training erschien im Browser eines deutschen Nutzers als 16:00.
 * Werte, die bereits eine Zone tragen (`bookings.session_start_time` u. a.),
 * bleiben unangetastet.
 */
export function asUtcIso(value: string | Date | null | undefined): string | Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  return /(Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
}

/** Format weekday + day + month (e.g., "Dienstag, 6. Oktober") */
export function formatWeekdayDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  try {
    return WEEKDAY_DATE_FORMATTER.format(new Date(value));
  } catch {
    return '—';
  }
}

/** Format as EUR currency (e.g., "1.234,56 €") */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '—';
  return CURRENCY_FORMATTER.format(value);
}

/** Format a number with locale-specific grouping (e.g., "1.234") */
export function formatNumber(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '—';
  return NUMBER_FORMATTER.format(value);
}

/** Format a relative time string (e.g., "vor 5 Min.", "vor 2 Std.") */
export function formatRelativeTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'gerade eben';
    if (mins < 60) return `vor ${mins} Min.`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `vor ${hrs} Std.`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `vor ${days} Tagen`;
    return formatDateShort(iso);
  } catch {
    return '—';
  }
}

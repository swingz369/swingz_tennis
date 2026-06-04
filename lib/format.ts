/**
 * lib/format.ts — Centralized Formatting Utilities
 *
 * Single source of truth for date, time, currency, and number formatting.
 * All formatters use 'de-DE' locale for consistency.
 *
 * Inspired by TSOWAPP's lib/format.ts pattern.
 */

// ── Date & Time Formatters (pre-initialized for performance) ──────────────

const DATE_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const DATE_SHORT_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat('de-DE', {
  month: 'long',
  year: 'numeric',
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

/** Format month + year (e.g., "Januar 2024") */
export function formatMonthYear(value: string | Date | null | undefined): string {
  if (!value) return '—';
  try {
    return MONTH_YEAR_FORMATTER.format(new Date(value));
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

/**
 * Centralized locale utility.
 *
 * Provides a single source of truth for the application locale.
 * Currently hardcoded to 'de' (German), but structured so that
 * a future i18n system (next-intl, user preference, etc.) can
 * plug in here without touching every component.
 */

import { de as dateLocaleDe } from 'date-fns/locale';
export const de = dateLocaleDe;

/** Active locale code (BCP 47, e.g. 'de', 'en'). */
export const activeLocale = 'de' as const;
export type SupportedLocale = 'de' | 'en';

/**
 * Resolve the active date-fns locale object.
 * Extend with a Map / switch when supporting more languages.
 */
export function getDateLocale(): typeof de {
  return de;
}

/**
 * Format helpers that automatically use the active locale.
 */
export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat(activeLocale, {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(activeLocale, options).format(d);
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(activeLocale, options).format(value);
}

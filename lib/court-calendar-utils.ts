/**
 * Court Calendar Utilities
 *
 * Shared constants and helper functions used across court calendar components:
 * - components/court-calendar.tsx
 * - components/admin-court-calendar.tsx
 * - components/daily-court-view.tsx
 */

/** Standard hourly time slots for court booking views (06:00–22:00) */
export const CALENDAR_TIME_SLOTS = [
  '06:00',
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '22:00',
] as const;

/** Maps court surface codes to German labels */
export function getSurfaceLabel(surface: string): string {
  const labels: Record<string, string> = {
    clay: 'Sand',
    grass: 'Rasen',
    hard: 'Hartplatz',
    carpet: 'Teppich',
  };
  return labels[surface] || surface;
}

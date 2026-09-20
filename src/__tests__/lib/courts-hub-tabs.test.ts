import { describe, it, expect } from 'vitest';
import { resolveTab } from '@/app/(protected)/admin/(gated)/courts/courts-hub-tabs';

/**
 * Die Plätze-Seite hatte zwei verschachtelte Tab-Leisten (`?view=calendar|manage`
 * aussen, `?tab=` innen) und ist auf eine flache Leiste zusammengelegt worden.
 * Altlinks müssen weiter am richtigen Tab landen — `?view=manage&tab=closures`
 * steht z. B. fest in `components/calendar/calendar-banners.tsx`.
 */
describe('resolveTab', () => {
  const params = (query: string) => new URLSearchParams(query);

  it('öffnet ohne Parameter den Kalender', () => {
    expect(resolveTab(null)).toBe('calendar');
    expect(resolveTab(params(''))).toBe('calendar');
  });

  it('nimmt einen gültigen tab-Parameter', () => {
    expect(resolveTab(params('tab=courts'))).toBe('courts');
    expect(resolveTab(params('tab=closures'))).toBe('closures');
  });

  it('bildet den aufgelösten Wartungs-Tab auf „Wartung & Sperren“ ab', () => {
    expect(resolveTab(params('tab=maintenance'))).toBe('closures');
  });

  it('bildet Altlinks der verschachtelten Tabs ab', () => {
    expect(resolveTab(params('view=manage'))).toBe('courts');
    expect(resolveTab(params('view=manage&tab=closures'))).toBe('closures');
    expect(resolveTab(params('view=calendar'))).toBe('calendar');
  });

  it('fällt bei unbekanntem tab auf den view-Parameter zurück', () => {
    expect(resolveTab(params('tab=erfunden'))).toBe('calendar');
    expect(resolveTab(params('tab=erfunden&view=manage'))).toBe('courts');
  });

  it('ignoriert fremde Parameter des Kalenders', () => {
    expect(resolveTab(params('calView=weekly&calDate=2026-09-20'))).toBe('calendar');
  });
});

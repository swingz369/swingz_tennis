/**
 * Abo-Stufen der Plattform — Preise und Beschriftungen.
 *
 * Lagen vorher nur in `app/(protected)/owner/billing/page.tsx`. Das
 * Owner-Dashboard rechnet denselben MRR; zwei Kopien derselben Preisliste
 * driften garantiert auseinander, sobald ein Preis sich ändert.
 */

export const TIER_LABELS: Record<string, string> = {
  free: 'Kein Abo',
  solo_s: 'Einzelverein S',
  solo_l: 'Einzelverein L',
  school_s: 'Tennisschule S',
  school_l: 'Tennisschule L',
  starter: 'Starter', // legacy
  professional: 'Professional', // legacy
};

/** Monatspreis in Euro. Nur `subscription_status === 'active'` zählt in den MRR. */
export const PLAN_PRICES: Record<string, number> = {
  solo_s: 29,
  solo_l: 59,
  school_s: 99,
  school_l: 179,
  starter: 29,
  professional: 79,
};

/** Monatlich wiederkehrender Umsatz über alle zahlenden Abo-Inhaber. */
export function monthlyRecurringRevenue(
  subscribers: Array<{ subscription_tier?: string | null; subscription_status?: string | null }>
): number {
  return subscribers.reduce((sum, s) => {
    if (s.subscription_status !== 'active') return sum;
    return sum + (PLAN_PRICES[s.subscription_tier ?? 'free'] ?? 0);
  }, 0);
}

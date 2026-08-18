import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Zustand des SwingZ-Abos eines Admins/Superadmins.
 *
 * Geprüft wird pro Person, nicht pro Verein: das Abo hängt am Konto des
 * Admins (siehe lib/plans.ts und users.subscription_tier), nicht am Club —
 * ein Admin mit mehreren Vereinen kann dem also nicht durch Club-Wechsel
 * entkommen.
 *
 * - `ok`        → bezahltes, laufendes Abo
 * - `past_due`  → bezahlt, aber die letzte Abbuchung ist gescheitert
 * - `none`      → kein Abo. Es gibt bewusst keine Testphase: wer nicht zahlt,
 *                 kommt über den Onboarding-Wizard nicht hinaus.
 */
export type SubscriptionState = 'ok' | 'past_due' | 'none';

/** Status, in denen Stripe die Subscription als bezahlt und laufend führt. */
const LIVE_STATUSES = new Set(['active', 'trialing']);
/** Status, in denen der Kunde eingreifen muss, bevor es weitergeht. */
const DUNNING_STATUSES = new Set(['past_due', 'unpaid']);

export async function getSubscriptionState(
  supabase: SupabaseClient,
  userId: string
): Promise<SubscriptionState> {
  const { data } = await supabase
    .from('users')
    .select('subscription_tier, subscription_status')
    .eq('id', userId)
    .maybeSingle();

  const status = data?.subscription_status ?? null;
  const tier = data?.subscription_tier ?? 'free';

  if (status && DUNNING_STATUSES.has(status)) return 'past_due';
  // 'free' ist kein Plan, sondern die Abwesenheit eines Plans — der
  // Vorgabewert der Spalte. Ein frisches Konto landet hier.
  if (tier === 'free' || !status || !LIVE_STATUSES.has(status)) return 'none';
  return 'ok';
}

/**
 * Nur der Mahnfall. Getrennt von `getSubscriptionState`, weil die
 * API-Schicht Schreibzugriffe bei ausstehender Zahlung sperrt, ein Konto
 * ohne Abo aber weiterhin den Onboarding-Wizard bedienen können muss —
 * sonst kommt ein Neukunde nie bis zum Checkout.
 */
export async function isSubscriptionPastDue(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  return (await getSubscriptionState(supabase, userId)) === 'past_due';
}

import { env } from '@/lib/env';

/**
 * Basis-URL der App — eine Quelle statt zwei Variablennamen mit fünf Meinungen.
 *
 * Historisch lasen manche Stellen `NEXT_PUBLIC_SITE_URL`, andere
 * `NEXT_PUBLIC_APP_URL`, mit uneinheitlichen Rückfallwerten: mal
 * `https://swingz.vercel.app`, mal `https://swingz.cloud` (eine Domain, die nicht
 * antwortet), mal ein leerer String. Je nachdem, welcher Flow eine Mail oder einen
 * Stripe-Rücksprung baute, zeigte der Link woandershin.
 *
 * Reihenfolge: `NEXT_PUBLIC_APP_URL` (die in `lib/env.ts` validierte Variable) →
 * `NEXT_PUBLIC_SITE_URL` → das, was der Aufrufer als Fallback mitgibt (etwa
 * `request.nextUrl.origin`) → die produktive Adresse. Ein abschließender
 * Schrägstrich wird entfernt, damit `${appBaseUrl()}/dashboard` nie zu einem
 * doppelten Slash führt.
 */
export function appBaseUrl(fallback?: string): string {
  const value =
    // `env` ist die zod-validierte Quelle aus lib/env.ts; process.env deckt
    // NEXT_PUBLIC_SITE_URL ab, das dort (noch) nicht geführt wird.
    env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    fallback ||
    'https://swingz.vercel.app';
  return value.replace(/\/+$/, '');
}

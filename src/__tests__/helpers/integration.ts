/**
 * src/__tests__/helpers/integration.ts — Gating für DB-Integrationstests
 *
 * Diese Tests schreiben echte Daten und laufen nur, wenn:
 *   1. `SUPABASE_SERVICE_ROLE_KEY` gesetzt ist, UND
 *   2. `NEXT_PUBLIC_SUPABASE_URL` NICHT auf die Produktions-Instanz zeigt.
 *
 * Grund: `lib/billing-engine.ts` instanziiert `createServiceClient()` beim
 * Modul-Import. Ohne diesen Guard hätten lokale/CI-Läufe mit einer auf
 * Produktion zeigenden `.env.local` echte Testdaten in die Live-DB geschrieben
 * (dokumentiert in docs/OPEN_ITEMS.md, Punkt #14).
 */

/** Hostnamen, die NIE von Integrationstests berührt werden dürfen. */
const PRODUCTION_HOSTS = [/supabase\.swingz\.cloud/i];

/** Erkennt die Produktions-Instanz an der Supabase-URL. */
export function isProductionSupabase(url: string): boolean {
  return PRODUCTION_HOSTS.some((pattern) => pattern.test(url));
}

/**
 * Wahr, wenn Integrationstests laufen dürfen. Falsch bei fehlenden Env-Vars
 * ODER wenn die URL auf Produktion zeigt (Hard-Skip).
 */
export function hasIntegrationEnv(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return false;
  return !isProductionSupabase(url);
}

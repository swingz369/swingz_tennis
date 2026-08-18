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

/**
 * Löscht einen Testverein vollständig. Zwei Fallstricke, die dazu geführt haben,
 * dass bis 18.08.2026 59 Leichen ("RLS Test Club" × 20 usw.) in der lokalen DB
 * lagen, obwohl zwei der drei Tests ein Cleanup hatten:
 *
 *  1. `audit_logs`, `hours_logs` und `bookings` haben KEIN `ON DELETE CASCADE`
 *     auf `clubs` — sie müssen von Hand weg.
 *  2. Die Trigger `audit_{invoices,payments,sepa_mandates}` schreiben WÄHREND
 *     des Cascade-Deletes neue `audit_logs`-Zeilen. Deshalb erst die
 *     auditierten Tabellen leeren, dann `audit_logs`, dann den Verein.
 *
 * Fehler werden geworfen, nicht geschluckt — das Supabase-SDK meldet sie nur im
 * Rückgabewert, und genau dieses stille Scheitern war die Ursache.
 */
export async function deleteTestClub(supabase: any, clubId: string | undefined): Promise<void> {
  if (!clubId) return;
  // Auditierte Tabellen zuerst — ihre Trigger feuern hier, nicht später.
  for (const table of ['invoices', 'sepa_mandates']) {
    await supabase.from(table).delete().eq('club_id', clubId);
  }
  for (const table of ['audit_logs', 'hours_logs', 'bookings']) {
    await supabase.from(table).delete().eq('club_id', clubId);
  }
  const { error } = await supabase.from('clubs').delete().eq('id', clubId);
  if (error) throw new Error(`Testverein ${clubId} nicht gelöscht: ${error.message}`);
}

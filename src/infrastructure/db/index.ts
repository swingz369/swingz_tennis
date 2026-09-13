/**
 * src/infrastructure/db — die zwei zulässigen Wege zur Datenbank (ADR-005,
 * docs/ARCHIV/2026-09-13-architektur-analyse-datenzugriff.md § 5.1).
 *
 * Repositories bekommen ihren Datenbank-Kontext ausschliesslich über diese
 * beiden Funktionen — nie direkt `createServiceClient()` oder Drizzle.
 */
import 'server-only';
import type { AuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('infrastructure:db');

/**
 * Supabase-Client mit dem JWT des angemeldeten Nutzers. Läuft als
 * `authenticated` — RLS erzwingt die Mandantentrennung in der Datenbank,
 * nicht der Anwendungscode. Der Standardweg für jedes Repository.
 */
export function getUserDb(auth: AuthContext): AuthContext['supabase'] {
  return auth.supabase;
}

/**
 * Service-Role-Client ohne RLS (`BYPASSRLS`). Nur für die Whitelist aus
 * ADR-005: Cron-Jobs, Stripe-Webhook, Benachrichtigungen, Owner-Funktionen
 * (Owner hat keine Club-Membership, RLS kann für ihn nichts durchlassen).
 * `reason` ist Pflicht und landet im Log, damit jede Umgehung von RLS
 * nachvollziehbar bleibt — keine stille Ausnahme.
 */
export function systemDb(reason: string) {
  log.info('systemDb genutzt (RLS umgangen)', { reason });
  return createServiceClient();
}

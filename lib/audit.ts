/**
 * Zentrales Audit-Logging — der einzige Schreibpfad auf `audit_logs`.
 *
 * Warum es diesen Helper gibt (Live-Probe 15.08.2026, Tabelle hatte 0 Zeilen):
 *
 * 1. **RLS.** Auf `audit_logs` existiert nur eine SELECT-Policy
 *    (`audit_logs_admin_select`, Migration 20260812020000). Es gibt keine
 *    INSERT-Policy — jeder Insert über den User-Client (`auth.supabase`,
 *    `createClient()`) wird von RLS verworfen. Deshalb schreibt dieser
 *    Helper grundsätzlich mit dem Service-Client. Audit-Zeilen sollen
 *    ohnehin nicht vom Nutzer schreibbar sein.
 * 2. **Spaltennamen.** Die Live-Tabelle hat exakt: id, actor_id, action,
 *    resource_type, resource_id, details, metadata, club_id, ip_address,
 *    user_agent, created_at. Aufrufer hatten u. a. `user_id`, `table_name`,
 *    `record_id`, `performed_by` geschrieben → 42703, still verschluckt.
 * 3. **`club_id`.** Der Admin-Tab filtert strikt `.eq('club_id', clubId)`.
 *    Ein Eintrag ohne club_id ist für Admins unsichtbar (nur der Owner
 *    sieht ihn). null also nur für echte Plattform-Aktionen.
 * 4. **NOT-NULL-Constraints.** `actor_id` (FK auf users.id) und
 *    `resource_id` (uuid) sind NOT NULL — ein Nicht-UUID wie `list:all`
 *    kippt den Insert mit 22P02.
 *
 * Fehler beim Audit-Schreiben kippen nie die auslösende Aktion.
 */

import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('audit');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nur die Header-Fähigkeit, damit NextRequest, Request und Tests passen. */
type HeaderSource = { headers: { get(name: string): string | null } };

export interface AuditEntry {
  /** auth-User-ID des Handelnden. Muss in `users` existieren (FK). */
  actorId: string;
  /** Freitext-Verb, z. B. 'member_deactivated'. UI-Labels: audit-logs-tab.tsx */
  action: string;
  /** Betroffener Typ, z. B. 'membership' | 'member' | 'club'. */
  resourceType: string;
  /** UUID des betroffenen Objekts. Kein UUID → Fallback clubId + details.resource_ref. */
  resourceId?: string | null;
  /** Verein. null nur bei plattformweiten Aktionen (Owner-Ebene). */
  clubId?: string | null;
  details?: Record<string, unknown>;
  /** Request für IP/User-Agent. */
  request?: HeaderSource | null;
}

function toRow(entry: AuditEntry) {
  // actor_id ist FK auf users.id — Platzhalter wie 'system' (Cron/Jobs) würden
  // den Insert mit 23503 kippen. Solche Einträge werden verworfen, nicht geraten.
  if (!entry.actorId || !UUID_RE.test(entry.actorId)) return null;

  const details: Record<string, unknown> = { ...(entry.details ?? {}) };

  // resource_id ist uuid NOT NULL. Nicht-UUIDs (z. B. 'list:all') würden den
  // Insert kippen — sie wandern in die Details, der Verein trägt die Zeile.
  let resourceId = entry.resourceId ?? null;
  if (!resourceId || !UUID_RE.test(resourceId)) {
    if (resourceId) details.resource_ref = resourceId;
    resourceId = entry.clubId ?? null;
  }
  if (!resourceId) return null;

  const headers = entry.request?.headers;
  return {
    actor_id: entry.actorId,
    action: entry.action,
    resource_type: entry.resourceType,
    resource_id: resourceId,
    club_id: entry.clubId ?? null,
    details,
    ip_address:
      headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ?? headers?.get('x-real-ip') ?? null,
    user_agent: headers?.get('user-agent') ?? null,
  };
}

/**
 * Schreibt einen oder mehrere Audit-Einträge. Wirft nie.
 *
 * ```ts
 * await logAudit({
 *   actorId: auth.user.id,
 *   action: 'member_deactivated',
 *   resourceType: 'membership',
 *   resourceId: membershipId,
 *   clubId: membership.club_id,
 *   details: { role: membership.role },
 *   request,
 * });
 * ```
 */
export async function logAudit(entry: AuditEntry | AuditEntry[]): Promise<void> {
  const entries = Array.isArray(entry) ? entry : [entry];
  if (entries.length === 0) return;

  const rows = entries.map(toRow).filter((r): r is NonNullable<typeof r> => r !== null);
  if (rows.length < entries.length) {
    log.error(
      `Audit-Eintrag verworfen — actor_id kein UUID oder keine verwertbare resource_id (${entries[0]?.action})`
    );
  }
  if (rows.length === 0) return;

  try {
    const { error } = await createServiceClient()
      .from('audit_logs')
      .insert(rows as never);
    if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim());
  } catch (err) {
    log.error(
      `Audit-Log fehlgeschlagen (${entries[0]?.action})`,
      err instanceof Error ? err : undefined
    );
  }
}

export { toRow as _toAuditRow };

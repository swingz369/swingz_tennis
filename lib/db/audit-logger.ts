/**
 * B8/A4: PII-Read-Audit-Logger
 * Non-fatal fire-and-forget. Rate-dedup 60s per (actor, resource_type, resource_id).
 *
 * Schreibt über `logAudit()` (lib/audit.ts) — dort liegt der einzige
 * Insert-Pfad auf `audit_logs` inkl. Service-Client und Spalten-Mapping.
 */

import { logAudit } from '@/lib/audit';
import type { NextRequest } from 'next/server';

const DEDUP_WINDOW_MS = 60_000;
const DEDUP_MAX = 2000;
const dedupMap = new Map<string, number>();

function shouldLog(actorId: string, resourceType: string, resourceId: string): boolean {
  const key = `${actorId}:${resourceType}:${resourceId}`;
  const now = Date.now();
  const last = dedupMap.get(key);
  if (last !== undefined && now - last < DEDUP_WINDOW_MS) return false;
  if (dedupMap.size >= DEDUP_MAX) {
    const oldest = dedupMap.keys().next().value;
    if (oldest) dedupMap.delete(oldest);
  }
  dedupMap.set(key, now);
  return true;
}

export async function logPiiRead(
  actorId: string,
  resourceType: string,
  resourceId: string,
  req?: NextRequest,
  details?: Record<string, unknown>,
  clubId?: string | null
): Promise<void> {
  if (!shouldLog(actorId, resourceType, resourceId)) return;
  await logAudit({
    actorId,
    action: 'PII_READ',
    resourceType,
    // Listen-Reads übergeben Pseudo-IDs wie `list:<clubId>`; logAudit legt die
    // in details.resource_ref ab und hängt die Zeile an den Verein.
    resourceId,
    clubId: clubId ?? null,
    details: { schema_version: 1, ...details },
    request: req ?? null,
  });
}

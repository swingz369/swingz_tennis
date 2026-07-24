/**
 * B8/A4: PII-Read-Audit-Logger
 * Non-fatal fire-and-forget. Rate-dedup 60s per (actor, resource_type, resource_id).
 */

import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import type { NextRequest } from 'next/server';

const log = createLogger('audit-logger');

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
  details?: Record<string, unknown>
): Promise<void> {
  if (!shouldLog(actorId, resourceType, resourceId)) return;
  try {
    const sb = createServiceClient();
    await sb.from('audit_logs').insert({
      action: 'PII_READ',
      actor_id: actorId,
      resource_type: resourceType,
      resource_id: resourceId,
      ip_address: req?.headers.get('x-forwarded-for') ?? req?.headers.get('x-real-ip') ?? null,
      user_agent: req?.headers.get('user-agent') ?? null,
      details: { schema_version: 1, ...details },
    });
  } catch (err) {
    log.error('PII_READ log failed', err instanceof Error ? err : undefined);
  }
}

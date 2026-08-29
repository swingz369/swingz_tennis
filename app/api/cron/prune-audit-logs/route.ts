/**
 * GET /api/cron/prune-audit-logs
 *
 * Cron-Job: setzt die Aufbewahrungsregel für `audit_logs` durch.
 *
 * Die Regel selbst steht in der Datenbank (`prune_audit_logs()`, Migration
 * 20260816100000) und nicht hier — dieselbe Löschung soll auch dann greifen,
 * wenn sie jemand von Hand anstößt, und die Fristen gehören zur Tabelle, nicht
 * zur Route. Diese Route ist nur der Auslöser.
 *
 * Fristen: Lese-Protokolle 90 Tage, Sicherheitsprotokolle 12 Monate,
 * Finanzvorgänge unbegrenzt (§ 147 AO).
 *
 * Auth: Header `Authorization: Bearer <CRON_SECRET>` (Vercel-Cron-Konvention).
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import { recordHeartbeat } from '@/lib/ops-heartbeat';
import { env } from '@/lib/env';

const log = createLogger('cron:prune-audit-logs');

export async function GET(req: NextRequest) {
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) {
    log.error('CRON_SECRET not configured — rejecting request');
    return NextResponse.json({ error: 'Dienst fehlkonfiguriert' }, { status: 500 });
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    log.error('Cron-Aufruf mit ungültigem Secret abgewiesen');
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  try {
    const { data, error } = await createServiceClient().rpc('prune_audit_logs');
    if (error) throw new Error(error.message);

    const result = Array.isArray(data) ? data[0] : data;
    log.info('Audit-Logs bereinigt', result ?? {});
    // Lebenszeichen fuer /api/health (PRODUKTIONSREIFE.md 5.3)
    await recordHeartbeat('cron-prune-audit-logs');
    return NextResponse.json({ success: true, ...(result ?? {}) });
  } catch (err) {
    log.error('Bereinigung fehlgeschlagen', err instanceof Error ? err : undefined);
    return internalErrorResponse();
  }
}

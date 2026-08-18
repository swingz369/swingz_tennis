import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import { MONITORED_JOBS } from '@/lib/ops-heartbeat';

const log = createLogger('api:health');

export const dynamic = 'force-dynamic';

/**
 * Erreichbarkeit plus Totmannschalter aller geplanten Jobs.
 *
 * Bis zum 18.08.2026 wurde hier nur das VPS-Backup geprüft; die fünf
 * Cron-Jobs aus `vercel.json` (Mahnwesen, nuLiga, Erinnerungen, Reaktivierung,
 * Log-Bereinigung) liefen unbeobachtet. Ein stillstehender Mahnlauf erzeugt
 * einfach nichts und fällt damit monatelang niemandem auf
 * (PRODUKTIONSREIFE.md 5.3). Die Grenzen je Job stehen in lib/ops-heartbeat.ts.
 */
export async function GET() {
  const start = Date.now();
  let supabaseOk = false;
  const jobs: Record<string, { status: 'ok' | 'veraltet' | 'unbekannt'; ageHours: number | null }> =
    {};

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('clubs').select('id').limit(1);
    supabaseOk = !error;
    if (error) log.error('Health supabase check failed', error);

    if (supabaseOk) {
      const { data } = await supabase.from('ops_heartbeats').select('name, last_seen_at');
      const seen = new Map((data ?? []).map((r) => [r.name, r.last_seen_at]));

      for (const [name, { maxAgeHours }] of Object.entries(MONITORED_JOBS)) {
        const last = seen.get(name);
        if (!last) {
          // Fehlt die Zeile, ist der Job noch nie durchgelaufen — ein anderer
          // Zustand als "veraltet", und beim ersten Deploy der Normalfall.
          jobs[name] = { status: 'unbekannt', ageHours: null };
          continue;
        }
        const ageHours =
          Math.round(((Date.now() - new Date(last).getTime()) / 3_600_000) * 10) / 10;
        jobs[name] = { status: ageHours <= maxAgeHours ? 'ok' : 'veraltet', ageHours };
      }
    }
  } catch (e) {
    log.error('Health check threw', e instanceof Error ? e : undefined);
  }

  const stale = Object.entries(jobs)
    .filter(([, j]) => j.status === 'veraltet')
    .map(([name]) => name);

  return NextResponse.json(
    {
      status: supabaseOk && stale.length === 0 ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      checks: { supabase: supabaseOk ? 'ok' : 'error' },
      jobs,
      ...(stale.length > 0 ? { ueberfaellig: stale } : {}),
      responseTime: `${Date.now() - start}ms`,
    },
    {
      // Der Datenbankausfall bleibt der harte Fehler. Ein überfälliger Job
      // meldet 200 mit `status: error` — sonst würde die Überwachung die App
      // als tot melden, obwohl Vereine ungestört weiterarbeiten.
      status: supabaseOk ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}

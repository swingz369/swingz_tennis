import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:health');

export const dynamic = 'force-dynamic';

/**
 * Ab wann das Backup als überfällig gilt. Es läuft täglich um 03:00; ein
 * einzelner ausgefallener Lauf ist noch kein Alarm, zwei hintereinander schon.
 */
const BACKUP_MAX_AGE_HOURS = 36;

export async function GET() {
  const start = Date.now();
  let supabaseOk = false;
  let backupAgeHours: number | null = null;

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('clubs').select('id').limit(1);
    supabaseOk = !error;
    if (error) log.error('Health supabase check failed', error);

    if (supabaseOk) {
      // Das Backup läuft auf dem VPS und meldet sich hier; siehe
      // docs/RUNBOOK-BACKUP-ROLLBACK.md § 3. Fehlt die Zeile, war noch nie
      // eines erfolgreich — das ist ein anderer Zustand als "veraltet".
      const { data } = await supabase
        .from('ops_heartbeats')
        .select('last_seen_at')
        .eq('name', 'vps-backup')
        .maybeSingle();

      if (data?.last_seen_at) {
        backupAgeHours =
          Math.round(((Date.now() - new Date(data.last_seen_at).getTime()) / 3_600_000) * 10) / 10;
      }
    }
  } catch (e) {
    log.error('Health check threw', e instanceof Error ? e : undefined);
  }

  const backupOk = backupAgeHours !== null && backupAgeHours <= BACKUP_MAX_AGE_HOURS;
  const ok = supabaseOk && backupOk;

  return NextResponse.json(
    {
      status: ok ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      checks: {
        supabase: supabaseOk ? 'ok' : 'error',
        backup: backupOk ? 'ok' : backupAgeHours === null ? 'unbekannt' : 'veraltet',
      },
      backupAgeHours,
      responseTime: `${Date.now() - start}ms`,
    },
    {
      // Der Datenbankausfall bleibt der harte Fehler. Ein überfälliges Backup
      // meldet 200 mit `status: error` — sonst würde die Überwachung die App
      // als tot melden, obwohl Vereine ungestört weiterarbeiten.
      status: supabaseOk ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}

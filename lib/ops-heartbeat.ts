import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('ops-heartbeat');

/**
 * Lebenszeichen der geplanten Jobs (PRODUKTIONSREIFE.md 5.3).
 *
 * Grund: Ein Cron-Job, der aufhört zu laufen, sieht von außen aus wie einer,
 * der nichts zu tun hatte — er erzeugt einfach nichts. Ein stillstehender
 * Mahnlauf fällt so monatelang nicht auf. Erst ein Zeitstempel, der altert,
 * macht den Stillstand sichtbar.
 *
 * `/api/health` liest die Tabelle und meldet jeden überfälligen Job.
 */

/**
 * Erwartete Jobs mit ihrer Höchstalter-Grenze in Stunden.
 *
 * Die Grenze ist großzügiger als der Takt: ein einzelner ausgefallener Lauf
 * ist noch kein Alarm, zwei hintereinander schon. Wer in `vercel.json` einen
 * Job ergänzt, ergänzt ihn hier — sonst läuft er unbeobachtet.
 */
export const MONITORED_JOBS: Record<string, { maxAgeHours: number; label: string }> = {
  'vps-backup': { maxAgeHours: 36, label: 'VPS-Backup' },
  'cron-backup': { maxAgeHours: 36, label: 'Datenbank-Backup' },
  'cron-billing-overdue': { maxAgeHours: 36, label: 'Mahnlauf' },
  'cron-nuliga-sync': { maxAgeHours: 36, label: 'nuLiga-Abgleich' },
  'cron-booking-reminders': { maxAgeHours: 36, label: 'Buchungserinnerungen' },
  'cron-reactivation': { maxAgeHours: 36, label: 'Reaktivierung' },
  // Läuft nur sonntags — eine ausgefallene Woche darf nicht sofort Alarm geben.
  'cron-prune-audit-logs': { maxAgeHours: 24 * 9, label: 'Protokoll-Bereinigung' },
};

export type JobName = keyof typeof MONITORED_JOBS;

/**
 * Setzt das Lebenszeichen eines Jobs auf jetzt.
 *
 * Wirft bewusst nicht: ein Job, der seine Arbeit erledigt hat, soll nicht
 * daran scheitern, dass die Überwachung klemmt. Der Fehler steht im Log.
 */
export async function recordHeartbeat(name: string, detail?: Record<string, unknown>) {
  try {
    const { error } = await createServiceClient()
      .from('ops_heartbeats')
      .upsert(
        {
          name,
          last_seen_at: new Date().toISOString(),
          ...(detail ? { detail } : {}),
        } as never,
        { onConflict: 'name' }
      );
    if (error) log.error(`Heartbeat ${name} nicht geschrieben`, new Error(error.message));
  } catch (err) {
    log.error(`Heartbeat ${name} nicht geschrieben`, err instanceof Error ? err : undefined);
  }
}

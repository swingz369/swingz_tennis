/**
 * GET /api/cron/check-absences
 *
 * Cron-Job: Findet alle Mitglieder mit ≥3 no_show-Bookings in den letzten 60 Tagen,
 * bei denen in den letzten 30 Tagen KEINE Abwesenheits-Benachrichtigung verschickt wurde.
 * Trägt für jeden betroffenen Trainer eine Notification ein.
 *
 * Auth: Header x-cron-secret muss mit CRON_SECRET übereinstimmen.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('cron:check-absences');

const LOOKBACK_DAYS = 60;
const NO_SHOW_THRESHOLD = 3;
const COOLDOWN_DAYS = 30;

export async function GET(req: NextRequest) {
  // ── Auth: Cron-Secret prüfen ──────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  const incomingSecret = req.headers.get('x-cron-secret');

  if (!cronSecret || incomingSecret !== cronSecret) {
    log.error('Cron-Aufruf mit ungültigem Secret abgewiesen', undefined);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = createServiceClient();
  const now = new Date();

  const lookbackSince = new Date(now);
  lookbackSince.setDate(lookbackSince.getDate() - LOOKBACK_DAYS);

  const cooldownSince = new Date(now);
  cooldownSince.setDate(cooldownSince.getDate() - COOLDOWN_DAYS);

  try {
    // 1. Alle no_show-Bookings der letzten 60 Tage laden
    const { data: noShowRows, error: noShowErr } = await (service as any)
      .from('bookings')
      .select('member_id, club_id, id')
      .eq('status', 'no_show')
      .gte('created_at', lookbackSince.toISOString());

    if (noShowErr) {
      log.error(
        'no_show-Abfrage fehlgeschlagen',
        noShowErr instanceof Error ? noShowErr : undefined
      );
      return NextResponse.json({ error: noShowErr.message }, { status: 500 });
    }

    // 2. Gruppieren: (member_id, club_id) → Anzahl
    const countMap = new Map<string, { memberId: string; clubId: string; count: number }>();
    for (const row of noShowRows ?? []) {
      const key = `${row.member_id}::${row.club_id}`;
      const entry = countMap.get(key);
      if (entry) {
        entry.count++;
      } else {
        countMap.set(key, { memberId: row.member_id, clubId: row.club_id, count: 1 });
      }
    }

    // 3. Nur Einträge mit ≥ Schwellenwert
    const candidates = [...countMap.values()].filter((e) => e.count >= NO_SHOW_THRESHOLD);

    if (candidates.length === 0) {
      log.info('Keine Mitglieder mit Fehlzeiten über Schwellenwert', {
        threshold: NO_SHOW_THRESHOLD,
      });
      return NextResponse.json({ processed: 0, notified: 0 });
    }

    // 4. Bereits benachrichtigte (member_id, club_id)-Paare der letzten 30 Tage ausschließen
    // memberId wird in action_url gespeichert für zuverlässige Deduplizierung
    const { data: recentNotifsFull } = await (service as any)
      .from('notifications')
      .select('action_url, club_id')
      .eq('type', 'absence_alert')
      .gte('created_at', cooldownSince.toISOString());

    const alreadyNotified = new Set<string>();
    for (const n of recentNotifsFull ?? []) {
      if (n.action_url && n.club_id) {
        alreadyNotified.add(`${n.action_url}::${n.club_id}`);
      }
    }

    const toProcess = candidates.filter((c) => !alreadyNotified.has(`${c.memberId}::${c.clubId}`));

    let totalNotified = 0;

    for (const { memberId, clubId, count } of toProcess) {
      // Mitglied auflösen
      const { data: memberUser } = await (service as any)
        .from('users')
        .select('full_name, email')
        .eq('id', memberId)
        .single();

      const memberLabel =
        memberUser?.full_name || memberUser?.email || `Mitglied ${memberId.slice(0, 8)}`;

      // Trainer des Clubs ermitteln
      const { data: trainerRows } = await (service as any)
        .from('trainer_club')
        .select('trainer_id, trainers(user_id, name)')
        .eq('club_id', clubId);

      for (const row of trainerRows ?? []) {
        const trainer = Array.isArray(row.trainers) ? row.trainers[0] : row.trainers;
        if (!trainer?.user_id) continue;

        const { error: notifErr } = await (service as any).from('notifications').insert({
          user_id: trainer.user_id,
          club_id: clubId,
          type: 'absence_alert',
          title: 'Häufige Fehlzeiten',
          message: `${memberLabel} war ${count}x unentschuldigt abwesend (letzte ${LOOKBACK_DAYS} Tage). Bitte Kontakt aufnehmen.`,
          read: false,
          // Speichert memberId für Deduplizierungs-Check
          action_url: memberId,
        });

        if (notifErr) {
          log.error(
            'Benachrichtigung konnte nicht gespeichert werden',
            notifErr instanceof Error ? notifErr : undefined
          );
        } else {
          totalNotified++;
        }
      }
    }

    log.info('Fehlzeiten-Cron abgeschlossen', {
      candidates: candidates.length,
      processed: toProcess.length,
      notified: totalNotified,
    });

    return NextResponse.json({
      processed: toProcess.length,
      notified: totalNotified,
      skipped: candidates.length - toProcess.length,
    });
  } catch (err) {
    log.error('Fehlzeiten-Cron: unerwarteter Fehler', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}

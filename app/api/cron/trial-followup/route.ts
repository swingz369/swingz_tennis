import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServiceClient } from '@/lib/supabase/service';
import { env } from '@/lib/env';
import { createLogger } from '@/lib/logger';
import {
  nextFollowupStage,
  sendFollowupEmail,
  type FollowupKind,
} from '@/lib/trial-training/followup';

const log = createLogger('cron:trial-followup');

export const dynamic = 'force-dynamic';

const STAGE_TO_KIND: Record<number, FollowupKind> = {
  1: 'thanks',
  2: 'reminder',
  3: 'final',
};

/**
 * Täglicher Nurture-Lauf: findet abgeschlossene, noch nicht konvertierte
 * Probetrainings und verschickt die jeweils fällige Follow-up-Mail
 * (Danke → Erinnerung nach 2 Tagen → letzter Anstoß nach 7 Tagen).
 * `followup_stage` verhindert Doppelversand; die „Danke"-Mail geht schon
 * beim Abschluss im PATCH-Handler raus.
 *
 * Versandt wird nur an bestätigte Einwilligungen
 * (`marketing_consent_confirmed_at`). Erinnerung und letzter Anstoß bewerben
 * eine Mitgliedschaft — das ist Werbung im Sinne von § 7 UWG und braucht die
 * Einwilligung, nicht bloss das gesetzte Häkchen: `marketing_consent` ist das
 * angekreuzte Kästchen, bestätigt ist es erst, wenn der Token-Link geklickt
 * wurde (`confirmMarketingConsentByToken`). Bis 16.08.2026 filterte diese
 * Abfrage auf keins von beidem.
 *
 * Alt-Daten von vor dieser Migration erreicht der Lauf bewusst nicht: dort ist
 * `completed_at` NULL. Ein Backfill würde jedem längst abgeschlossenen
 * Probetraining auf einen Schlag eine Mail schicken.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) {
    log.error('CRON_SECRET not configured — rejecting request');
    return NextResponse.json({ error: 'Dienst fehlkonfiguriert' }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const checkInId = Sentry.captureCheckIn({
    monitorSlug: 'trial-followup',
    status: 'in_progress',
  });

  try {
    const svc = createServiceClient();
    const { data: trials, error } = await svc
      .from('trial_trainings')
      .select(
        'id, participant_id, participant_email, participant_first_name, club_id, followup_stage, completed_at'
      )
      .eq('status', 'completed')
      .is('converted_to_member_id', null)
      .not('completed_at', 'is', null)
      .not('marketing_consent_confirmed_at', 'is', null);

    if (error) throw error;

    let emailsSent = 0;
    for (const trial of trials ?? []) {
      const completedAt = new Date(trial.completed_at);
      const daysSinceCompleted = Math.floor((Date.now() - completedAt.getTime()) / 86_400_000);
      const stage = trial.followup_stage ?? 0;
      const next = nextFollowupStage(stage, daysSinceCompleted);
      if (next === stage) continue;

      const kind = STAGE_TO_KIND[next];
      if (!kind) continue;

      const { data: clubRow } = await svc
        .from('clubs')
        .select('name')
        .eq('id', trial.club_id)
        .maybeSingle();

      const ok = await sendFollowupEmail({
        to: trial.participant_email,
        name: trial.participant_first_name,
        clubName: clubRow?.name ?? 'Dein Tennisverein',
        kind,
        participantId: trial.participant_id,
      });

      if (ok) {
        await svc
          .from('trial_trainings')
          .update({ followup_stage: next, updated_at: new Date().toISOString() })
          .eq('id', trial.id);
        emailsSent++;
      }
    }

    Sentry.captureCheckIn({ checkInId, monitorSlug: 'trial-followup', status: 'ok' });
    return NextResponse.json({
      success: true,
      processed: trials?.length ?? 0,
      emailsSent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('Trial followup cron failed', { error: message });
    Sentry.captureCheckIn({ checkInId, monitorSlug: 'trial-followup', status: 'error' });
    Sentry.captureException(error, { tags: { cron: 'trial-followup' } });
    return NextResponse.json({ error: 'Cron-Job fehlgeschlagen', message }, { status: 500 });
  }
}

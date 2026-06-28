/**
 * GET /api/cron/invalidate-stale-consents
 *
 * F9.5: Täglicher Cron-Job, der DSGVO-stale Opt-Ins markiert.
 *
 * Ablauf:
 *  1. Header `x-cron-secret` muss mit ENV `CRON_SECRET` matchen (sonst 401).
 *  2. Aktuelle Datenschutz-Version aus `env.NOTIFICATION_PRIVACY_VERSION` lesen.
 *  3. Alle notification_consents-Rows selektieren, deren
 *     `privacy_policy_version != currentVersion` UND die revoked_at IS NULL.
 *  4. Updates: `is_opted_in=false, revoked_at=NOW(), consent_source='system_privacy_update'`.
 *     → User sieht im UI: "Opt-In widerrufen (Datenschutz-Update) — bitte neu zustimmen."
 *  5. Sentry check-in (monitorSlug: 'invalidate-stale-consents').
 *
 * Authorization: Vercel-Cron ruft mit `x-cron-secret` Header. Beliebige andere
 * Caller brauchen den CRON_SECRET-Wert (nicht in Git). Siehe vercel.json
 * Schedule-Eintrag.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServiceClient } from '@/lib/supabase/service';
import { env } from '@/lib/env';
import { createLogger } from '@/lib/logger';
import { getCurrentPrivacyPolicyVersion } from '@/lib/notifications/consent';

const log = createLogger('cron:invalidate-stale-consents');

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // ── Auth: Cron-Secret prüfen ──────────────────────────────────────────────
  const cronSecret = env.CRON_SECRET;
  const incomingSecret = request.headers.get('x-cron-secret');
  if (!cronSecret || incomingSecret !== cronSecret) {
    log.error('Cron-Aufruf mit ungültigem Secret abgewiesen', undefined);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!cronSecret) {
    // env.CRON_SECRET undefined in production → fail closed.
    log.error('CRON_SECRET nicht konfiguriert — Cron deaktiviert', undefined);
    return NextResponse.json({ error: 'Service misconfigured' }, { status: 500 });
  }

  // ── Sentry cron monitoring: start check-in ────────────────────────────────
  const checkInId = Sentry.captureCheckIn({
    monitorSlug: 'invalidate-stale-consents',
    status: 'in_progress',
  });

  const currentVersion = getCurrentPrivacyPolicyVersion();
  const now = new Date().toISOString();
  const consentSource = 'system_privacy_update';

  try {
    const supabase = createServiceClient();

    // 1) Stale-Rows zählen (für Log + Return-Summary, vor dem Update).
    // types/supabase.ts enthält notification_consents (gen:types post F9.5-Deploy).
    const { data: staleRows, error: selectErr } = await supabase
      .from('notification_consents')
      .select('id, user_id, channel')
      .is('revoked_at', null)
      .neq('privacy_policy_version', currentVersion);

    if (selectErr) {
      log.error(
        'Stale-Consent-Select fehlgeschlagen',
        selectErr instanceof Error ? selectErr : undefined
      );
      Sentry.captureCheckIn({
        checkInId,
        monitorSlug: 'invalidate-stale-consents',
        status: 'error',
      });
      Sentry.captureException(selectErr, { tags: { cron: 'invalidate-stale-consents' } });
      return NextResponse.json({ error: 'Select failed' }, { status: 500 });
    }

    const staleCount = staleRows?.length ?? 0;

    if (staleCount === 0) {
      log.info('Keine stale Opt-Ins zum Invalidieren', { currentVersion });
      Sentry.captureCheckIn({
        checkInId,
        monitorSlug: 'invalidate-stale-consents',
        status: 'ok',
      });
      return NextResponse.json({
        currentVersion,
        invalidated: 0,
        skipped: 0,
      });
    }

    // 2) Bulk-Update via .in() auf den selektierten IDs.
    //    types/supabase.ts: Update-Response-Daten-Typ ist mit `.select('id')` als
    //    `Array<{id: string}>` typed; ohne .select() wäre `data: null`, und
    //    `.length` würde TS-Narrowing auf `never` verlieren (siehe F9.5-PostGen).
    const staleIds = (staleRows ?? []).map((r) => r.id);
    const { error: updateErr, data: updatedRows } = await supabase
      .from('notification_consents')
      .update({
        is_opted_in: false,
        revoked_at: now,
        consent_source: consentSource,
        updated_at: now,
      })
      .in('id', staleIds)
      .select('id');

    if (updateErr) {
      log.error(
        'Stale-Consent-Bulk-Update fehlgeschlagen',
        updateErr instanceof Error ? updateErr : undefined
      );
      Sentry.captureCheckIn({
        checkInId,
        monitorSlug: 'invalidate-stale-consents',
        status: 'error',
      });
      Sentry.captureException(updateErr, { tags: { cron: 'invalidate-stale-consents' } });
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }

    log.info('Stale Opt-Ins invalidiert', {
      currentVersion,
      invalidated: updatedRows?.length ?? staleCount,
      sampleIds: staleIds.slice(0, 5),
    });

    // 3) Optional: Admin-Notification (für Awareness bei hohem Volumen).
    //    Wenn >50 stale → eine Notification pro Owner-User für Monitoring.
    //    Bewusst kein Auto-Re-Consent-Prompt — User muss aktiv zustimmen.
    //
    // F9.5-FU (Owner-Lookup semantisch korrekt):
    //   Rollen leben in `user_club_memberships.role` — `users.role` ist veraltet
    //   (CLAUDE.md § "Owner-Besonderheiten"). Owner-Memberships haben per
    //   Convention `club_id = NULL` und `is_active = TRUE` (siehe
    //   seeds/seed-test-data.ts:307 + Migration 20260621_add_owner_role.sql:14).
    //   Dedup via Set, weil ein Owner-User theor. mehrere Membership-Rows haben
    //   kann (z. B. historische Re-Zuordnung Owner → Superadmin → Owner) und pro
    //   Owner-User genau 1 Notification ankommen soll.
    //   FK-Beziehung user_club_memberships.user_id <= users.id erlaubt das
    //   direkte Verwenden der `user_id` als `notifications.user_id` (FK dort).
    if ((updatedRows?.length ?? staleCount) > 50) {
      try {
        const { data: ownerMemberships } = await supabase
          .from('user_club_memberships')
          .select('user_id')
          .eq('role', 'owner')
          .eq('is_active', true);

        const uniqueOwnerIds = Array.from(new Set((ownerMemberships ?? []).map((m) => m.user_id)));

        if (uniqueOwnerIds.length > 0) {
          await supabase.from('notifications').insert(
            uniqueOwnerIds.map((userId) => ({
              user_id: userId,
              type: 'system_alert',
              title: 'Datenschutz-Update invalidiert viele Opt-Ins',
              message: `${updatedRows?.length ?? staleCount} Mitglieder-Opt-Ins wurden invalidiert (privacy_version=${currentVersion}). User müssen neu zustimmen.`,
              read: false,
            }))
          );
        }
      } catch (notifErr) {
        log.warn(
          'Admin-Notification konnte nicht gesendet werden (non-blocking)',
          notifErr instanceof Error ? notifErr : undefined
        );
      }
    }

    // ── Sentry check-in: OK ─────────────────────────────────────────────────
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: 'invalidate-stale-consents',
      status: 'ok',
    });

    return NextResponse.json({
      currentVersion,
      invalidated: updatedRows?.length ?? staleCount,
      skipped: 0,
    });
  } catch (err) {
    log.error('invalidate-stale-consents exception', err instanceof Error ? err : undefined);
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: 'invalidate-stale-consents',
      status: 'error',
    });
    Sentry.captureException(err, { tags: { cron: 'invalidate-stale-consents' } });
    return NextResponse.json({ error: 'Internal' }, { status: 500 });
  }
}

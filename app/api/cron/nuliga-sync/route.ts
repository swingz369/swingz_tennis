import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import { env } from '@/lib/env';
import { isValidNuligaUrl } from '@/lib/services/nuliga-scraper';
import { syncLeagueFromNuliga } from '@/lib/services/nuliga-sync';
import { recordHeartbeat } from '@/lib/ops-heartbeat';

const log = createLogger('cron:nuliga-sync');

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/nuliga-sync
 *
 * Täglicher Abgleich aller verbundenen nuLiga-Ligen (Vercel Cron, siehe
 * vercel.json). Die Übernahme-Logik teilt sich diese Route mit dem manuellen
 * Sync — `lib/services/nuliga-sync.ts`.
 *
 * ponytail: sequenziell mit 1 s Pause. Ab ~20 verbundenen Ligen reißt das die
 * Vercel-Function-Laufzeit; dann auf Cursor-Batches (mehrere Cron-Slots)
 * umstellen, nicht auf Parallelität — nuLiga soll höflich abgefragt werden.
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
    monitorSlug: 'nuliga-sync',
    status: 'in_progress',
  });

  try {
    const supabase = createServiceClient();

    const { data: leagues, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name, nuliga_url, own_team_name, club_id')
      .not('nuliga_url', 'is', null);

    if (leagueError) throw leagueError;

    if (!leagues || leagues.length === 0) {
      log.info('No leagues with nuliga_url configured — nothing to sync');
      Sentry.captureCheckIn({ checkInId, monitorSlug: 'nuliga-sync', status: 'ok' });
      return NextResponse.json({ success: true, synced: 0, message: 'Keine Ligen verbunden' });
    }

    log.info(`Starting auto-sync for ${leagues.length} connected league(s)`);

    let synced = 0;
    let failed = 0;
    const errors: Array<{ leagueId: string; leagueName: string; error: string }> = [];
    /** Ligen ohne erkennbare eigene Mannschaft — Tabelle ja, Spielplan nein. */
    const unresolved: string[] = [];

    for (const league of leagues) {
      const nuligaUrl = league.nuliga_url as string;

      if (!isValidNuligaUrl(nuligaUrl)) {
        log.warn(`Skipping league "${league.name}" — invalid nuLiga URL: ${nuligaUrl}`);
        errors.push({
          leagueId: league.id,
          leagueName: league.name,
          error: 'Ungültige nuLiga-URL',
        });
        failed++;
        continue;
      }
      if (!league.club_id) {
        errors.push({ leagueId: league.id, leagueName: league.name, error: 'Keine club_id' });
        failed++;
        continue;
      }

      const syncStartTime = Date.now();

      try {
        // Rate-Limit: höfliche 1 s Pause zwischen nuLiga-Abrufen
        if (synced + failed > 0) await new Promise((r) => setTimeout(r, 1000));

        const result = await syncLeagueFromNuliga(
          supabase,
          {
            id: league.id,
            club_id: league.club_id,
            name: league.name,
            own_team_name: league.own_team_name,
          },
          nuligaUrl
        );

        if (!result.ownTeam) unresolved.push(league.name);

        const completedAt = new Date();
        await supabase
          .from('leagues')
          .update({
            last_synced_at: completedAt.toISOString(),
            ...(result.ownTeam && result.ownTeam !== league.own_team_name
              ? { own_team_name: result.ownTeam }
              : {}),
          })
          .eq('id', league.id);

        await supabase.from('nuliga_sync_log').insert({
          league_id: league.id,
          club_id: league.club_id,
          status: 'success',
          trigger: 'cron',
          teams_created: result.teamsCreated,
          teams_updated: result.teamsUpdated,
          matches_created: result.matchesCreated,
          matches_updated: result.matchesUpdated,
          nuliga_url: nuligaUrl,
          nuliga_group_name: result.groupName,
          nuliga_championship: result.championship,
          started_at: new Date(syncStartTime).toISOString(),
          completed_at: completedAt.toISOString(),
          duration_ms: Date.now() - syncStartTime,
        });

        log.info(
          `Synced "${league.name}": ${result.teamsCreated}+${result.teamsUpdated} teams, ${result.matchesCreated}+${result.matchesUpdated} matches, ${result.skippedForeign} fremde übersprungen`
        );
        synced++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        log.error(`Failed to sync league "${league.name}"`, { error: message });
        errors.push({
          leagueId: league.id,
          leagueName: league.name,
          error: 'Synchronisierung fehlgeschlagen',
        });
        failed++;

        if (league.club_id) {
          void supabase.from('nuliga_sync_log').insert({
            league_id: league.id,
            club_id: league.club_id,
            status: 'failed',
            trigger: 'cron',
            error_message: message,
            nuliga_url: nuligaUrl,
            started_at: new Date(syncStartTime).toISOString(),
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - syncStartTime,
          });
        }
      }
    }

    Sentry.captureCheckIn({ checkInId, monitorSlug: 'nuliga-sync', status: 'ok' });

    // Lebenszeichen fuer /api/health (PRODUKTIONSREIFE.md 5.3)
    await recordHeartbeat('cron-nuliga-sync');
    return NextResponse.json({
      success: true,
      total: leagues.length,
      synced,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      unresolvedOwnTeam: unresolved.length > 0 ? unresolved : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('nuLiga sync cron failed', { error: message });

    Sentry.captureCheckIn({ checkInId, monitorSlug: 'nuliga-sync', status: 'error' });
    Sentry.captureException(error, { tags: { cron: 'nuliga-sync' } });

    return NextResponse.json({ error: 'Cron-Job fehlgeschlagen' }, { status: 500 });
  }
}

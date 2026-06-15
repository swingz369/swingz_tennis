import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import { env } from '@/lib/env';
import {
  fetchNuligaGroupPage,
  isValidNuligaUrl,
  parseNuligaDate,
  parseScore,
} from '@/lib/services/nuliga-scraper';

const log = createLogger('cron:nuliga-sync');

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/nuliga-sync
 *
 * Automated daily sync of all connected nuLiga leagues.
 * Triggered by Vercel Cron (see vercel.json).
 *
 * For each league with a configured nuliga_url, fetches the latest
 * standings and match results from nuLiga and upserts them into SwingZ.
 */
export async function GET(request: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) {
    log.error('CRON_SECRET not configured — rejecting request');
    return NextResponse.json({ error: 'Service misconfigured' }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Sentry cron monitoring ───────────────────────────────────────────
  const checkInId = Sentry.captureCheckIn({
    monitorSlug: 'nuliga-sync',
    status: 'in_progress',
  });

  try {
    const supabase = createServiceClient();

    // Find all leagues with a nuLiga URL
    const { data: leagues, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name, nuliga_url, club_id')
      .not('nuliga_url', 'is', null);

    if (leagueError) throw leagueError;

    if (!leagues || leagues.length === 0) {
      log.info('No leagues with nuliga_url configured — nothing to sync');
      Sentry.captureCheckIn({ checkInId, monitorSlug: 'nuliga-sync', status: 'ok' });
      return NextResponse.json({ success: true, synced: 0, message: 'No leagues connected' });
    }

    log.info(`Starting auto-sync for ${leagues.length} connected league(s)`);

    // ── Sync each league ─────────────────────────────────────────────
    let synced = 0;
    let failed = 0;
    const errors: Array<{ leagueId: string; leagueName: string; error: string }> = [];

    for (const league of leagues) {
      const nuligaUrl = league.nuliga_url as string;

      if (!isValidNuligaUrl(nuligaUrl)) {
        log.warn(`Skipping league "${league.name}" — invalid nuLiga URL: ${nuligaUrl}`);
        errors.push({ leagueId: league.id, leagueName: league.name, error: 'Invalid nuLiga URL' });
        failed++;
        continue;
      }

      const syncStartTime = Date.now();

      try {
        // Rate-limit: polite 1s delay between nuLiga requests
        if (synced + failed > 0) {
          await new Promise((r) => setTimeout(r, 1000));
        }
        const nuligaData = await fetchNuligaGroupPage(nuligaUrl);

        // ── Upsert Teams ──────────────────────────────────────────────
        const { data: existingTeams } = await supabase
          .from('teams')
          .select(
            'id, name, position, points, matches_played, matches_won, matches_lost, matches_drawn'
          )
          .eq('league_id', league.id);

        const existingByName = new Map<string, any>(
          (existingTeams ?? []).map((t: any) => [t.name.trim().toLowerCase(), t])
        );

        let teamsCreated = 0;
        let teamsUpdated = 0;

        for (const standing of nuligaData.standings) {
          const key = standing.teamName.trim().toLowerCase();
          const existing = existingByName.get(key);

          if (existing) {
            const needsUpdate =
              existing.position !== standing.rank ||
              existing.points !== standing.points ||
              existing.matches_played !== standing.matchesPlayed ||
              existing.matches_won !== standing.wins ||
              existing.matches_lost !== standing.losses ||
              existing.matches_drawn !== standing.draws;

            if (needsUpdate) {
              await supabase
                .from('teams')
                .update({
                  position: standing.rank,
                  points: standing.points,
                  matches_played: standing.matchesPlayed,
                  matches_won: standing.wins,
                  matches_lost: standing.losses,
                  matches_drawn: standing.draws,
                })
                .eq('id', existing.id);
              teamsUpdated++;
            }
          } else if (league.club_id) {
            await supabase.from('teams').insert({
              club_id: league.club_id,
              league_id: league.id,
              name: standing.teamName,
              position: standing.rank,
              points: standing.points,
              matches_played: standing.matchesPlayed,
              matches_won: standing.wins,
              matches_lost: standing.losses,
              matches_drawn: standing.draws,
            });
            teamsCreated++;
          }
        }

        // ── Upsert Match Days ─────────────────────────────────────────
        const { data: existingMatchDays } = await supabase
          .from('match_days')
          .select('id, matchday_number, opponent, scheduled_date, status, score_home, score_away')
          .eq('league_id', league.id);

        const existingMatchMap = new Map<string, any>();
        for (const md of existingMatchDays ?? []) {
          const mk = `${md.opponent}|${md.scheduled_date || ''}`.toLowerCase();
          existingMatchMap.set(mk, md);
        }

        let matchesCreated = 0;
        let matchesUpdated = 0;
        let matchdayNum = 0;
        let lastDateKey = '';

        for (const match of nuligaData.matches) {
          const dateKey = match.date;
          if (dateKey !== lastDateKey) {
            matchdayNum++;
            lastDateKey = dateKey;
          }

          const parsedDate = parseNuligaDate(match.date);
          const scores = parseScore(match.matchPoints);

          let result: string | null = null;
          if (match.status === 'completed' && scores) {
            result =
              scores.home > scores.away ? 'win' : scores.home < scores.away ? 'loss' : 'draw';
          }

          const homeKey = `${match.homeTeam}|${parsedDate || ''}`.toLowerCase();
          const awayKey = `${match.awayTeam}|${parsedDate || ''}`.toLowerCase();
          const existing = existingMatchMap.get(homeKey) || existingMatchMap.get(awayKey);

          const matchData: Record<string, unknown> = {
            scheduled_date: parsedDate,
            opponent: match.homeTeam,
            is_home: true,
            venue: null,
            result,
            score_home: scores?.home ?? null,
            score_away: scores?.away ?? null,
            status: match.status === 'completed' ? 'completed' : 'pending',
            notes: `vs ${match.awayTeam}${match.matchPoints ? ` (${match.matchPoints})` : ''}`,
          };

          if (existing) {
            const needsUpdate =
              existing.status !== matchData.status ||
              existing.score_home !== matchData.score_home ||
              existing.score_away !== matchData.score_away;

            if (needsUpdate) {
              await supabase.from('match_days').update(matchData).eq('id', existing.id);
              matchesUpdated++;
            }
          } else {
            await supabase.from('match_days').insert({
              league_id: league.id,
              matchday_number: matchdayNum,
              ...matchData,
            });
            matchesCreated++;
          }
        }

        // Update last_synced_at
        const completedAt = new Date();
        await supabase
          .from('leagues')
          .update({ last_synced_at: completedAt.toISOString() })
          .eq('id', league.id);

        // Log sync result
        if (league.club_id) {
          await supabase.from('nuliga_sync_log').insert({
            league_id: league.id,
            club_id: league.club_id,
            status: 'success',
            trigger: 'cron',
            teams_created: teamsCreated,
            teams_updated: teamsUpdated,
            matches_created: matchesCreated,
            matches_updated: matchesUpdated,
            nuliga_url: nuligaUrl,
            nuliga_group_name: nuligaData.groupName,
            nuliga_championship: nuligaData.championship,
            started_at: new Date(syncStartTime).toISOString(),
            completed_at: completedAt.toISOString(),
            duration_ms: Date.now() - syncStartTime,
          });
        }

        log.info(
          `Synced "${league.name}": ${teamsCreated}+${teamsUpdated} teams, ${matchesCreated}+${matchesUpdated} matches`
        );
        synced++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        log.error(`Failed to sync league "${league.name}"`, { error: message });
        errors.push({ leagueId: league.id, leagueName: league.name, error: message });
        failed++;

        // Log failed sync (fire-and-forget)
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

    // ── Done ──────────────────────────────────────────────────────────
    Sentry.captureCheckIn({ checkInId, monitorSlug: 'nuliga-sync', status: 'ok' });

    return NextResponse.json({
      success: true,
      total: leagues.length,
      synced,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error('nuLiga sync cron failed', { error: message });

    Sentry.captureCheckIn({ checkInId, monitorSlug: 'nuliga-sync', status: 'error' });
    Sentry.captureException(error, { tags: { cron: 'nuliga-sync' } });

    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}

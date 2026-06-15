import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import {
  fetchNuligaGroupPage,
  isValidNuligaUrl,
  parseNuligaDate,
  parseScore,
} from '@/lib/services/nuliga-scraper';

/**
 * POST /api/leagues/[id]/sync — Sync league data from nuLiga
 *
 * Fetches standings and match results from the configured nuLiga URL,
 * then upserts teams and match days into the SwingZ database.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Admin access required');

    const { id } = await params;

    // Fetch league with nuliga_url
    const { data: league, error: leagueError } = await (auth.supabase as any)
      .from('leagues')
      .select('id, name, nuliga_url, club_id')
      .eq('id', id)
      .single();

    if (leagueError || !league) {
      return NextResponse.json({ error: 'Liga nicht gefunden' }, { status: 404 });
    }

    // Allow URL override via request body, or use stored URL
    let nuligaUrl = league.nuliga_url;
    try {
      const body = await request.json().catch(() => ({}));
      if (body?.nuliga_url) {
        nuligaUrl = body.nuliga_url;
      }
    } catch {
      // No body or invalid JSON — use stored URL
    }

    if (!nuligaUrl) {
      return NextResponse.json(
        {
          error:
            'Keine nuLiga-URL konfiguriert. Bitte hinterlege die URL in den Liga-Einstellungen.',
        },
        { status: 400 }
      );
    }

    if (!isValidNuligaUrl(nuligaUrl)) {
      return NextResponse.json(
        { error: 'Ungültige nuLiga-URL. Die URL muss von *.liga.nu stammen.' },
        { status: 400 }
      );
    }

    // ── Fetch from nuLiga ──────────────────────────────────────────────
    const startTime = Date.now();
    let nuligaData;
    try {
      nuligaData = await fetchNuligaGroupPage(nuligaUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      // Log failed sync
      if (league.club_id) {
        await (auth.supabase as any).from('nuliga_sync_log').insert({
          league_id: id,
          club_id: league.club_id,
          status: 'failed',
          trigger: 'manual',
          error_message: message,
          nuliga_url: nuligaUrl,
          started_at: new Date(startTime).toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
        });
      }
      return NextResponse.json(
        { error: `Fehler beim Abrufen von nuLiga: ${message}` },
        { status: 502 }
      );
    }

    // ── Upsert Teams from Standings ────────────────────────────────────
    let teamsCreated = 0;
    let teamsUpdated = 0;

    if (!league.club_id) {
      return NextResponse.json({ error: 'Liga hat keine club_id zugeordnet' }, { status: 400 });
    }

    // Fetch existing teams for this league
    const { data: existingTeams } = await (auth.supabase as any)
      .from('teams')
      .select(
        'id, name, position, points, matches_played, matches_won, matches_lost, matches_drawn'
      )
      .eq('league_id', id);

    const existingByName = new Map<string, any>(
      (existingTeams ?? []).map((t: any) => [t.name.trim().toLowerCase(), t])
    );

    for (const standing of nuligaData.standings) {
      const key = standing.teamName.trim().toLowerCase();
      const existing = existingByName.get(key);

      if (existing) {
        // Update existing team standings
        const needsUpdate =
          existing.position !== standing.rank ||
          existing.points !== standing.points ||
          existing.matches_played !== standing.matchesPlayed ||
          existing.matches_won !== standing.wins ||
          existing.matches_lost !== standing.losses ||
          existing.matches_drawn !== standing.draws;

        if (needsUpdate) {
          await (auth.supabase as any)
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
      } else {
        // Create new team
        await (auth.supabase as any).from('teams').insert({
          club_id: league.club_id,
          league_id: id,
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

    // ── Upsert Match Days from Spielplan ───────────────────────────────
    let matchesCreated = 0;
    let matchesUpdated = 0;

    // Fetch existing match days
    const { data: existingMatchDays } = await (auth.supabase as any)
      .from('match_days')
      .select('id, matchday_number, opponent, scheduled_date, status, score_home, score_away')
      .eq('league_id', id);

    // Build index: match key = "opponent|date" for matching
    const existingMatchMap = new Map<string, any>();
    for (const md of existingMatchDays ?? []) {
      const key = `${md.opponent}|${md.scheduled_date || ''}`.toLowerCase();
      existingMatchMap.set(key, md);
    }

    let matchdayNum = 0;
    let lastDateKey = '';

    for (const match of nuligaData.matches) {
      // Assign matchday number based on date grouping
      const dateKey = match.date;
      if (dateKey !== lastDateKey) {
        matchdayNum++;
        lastDateKey = dateKey;
      }

      // Parse date string to ISO format
      const parsedDate = parseNuligaDate(match.date);

      // Parse scores
      const scores = parseScore(match.matchPoints);

      // Determine result from home team perspective
      let result: string | null = null;
      if (match.status === 'completed' && scores) {
        result = scores.home > scores.away ? 'win' : scores.home < scores.away ? 'loss' : 'draw';
      }

      // Match key for upsert: opponent = homeTeam (our team perspective)
      // We try to match by both homeTeam and awayTeam as opponent
      const homeKey = `${match.homeTeam}|${parsedDate || ''}`.toLowerCase();
      const awayKey = `${match.awayTeam}|${parsedDate || ''}`.toLowerCase();
      const existingHome = existingMatchMap.get(homeKey);
      const existingAway = existingMatchMap.get(awayKey);
      const existing = existingHome || existingAway;

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
          await (auth.supabase as any).from('match_days').update(matchData).eq('id', existing.id);
          matchesUpdated++;
        }
      } else {
        await (auth.supabase as any).from('match_days').insert({
          league_id: id,
          matchday_number: matchdayNum,
          ...matchData,
        });
        matchesCreated++;
      }
    }

    // ── Update last_synced_at ──────────────────────────────────────────
    const completedAt = new Date();
    await (auth.supabase as any)
      .from('leagues')
      .update({
        last_synced_at: completedAt.toISOString(),
        nuliga_url: nuligaUrl,
      })
      .eq('id', id);

    // ── Log sync result (fire-and-forget) ──────────────────────────────
    const durationMs = completedAt.getTime() - startTime;
    void (auth.supabase as any)
      .from('nuliga_sync_log')
      .insert({
        league_id: id,
        club_id: league.club_id,
        status: 'success',
        trigger: 'manual',
        teams_created: teamsCreated,
        teams_updated: teamsUpdated,
        matches_created: matchesCreated,
        matches_updated: matchesUpdated,
        nuliga_url: nuligaUrl,
        nuliga_group_name: nuligaData.groupName,
        nuliga_championship: nuligaData.championship,
        started_at: new Date(startTime).toISOString(),
        completed_at: completedAt.toISOString(),
        duration_ms: durationMs,
      })
      .catch(() => {}); // Don't let log insert failure block the response

    return NextResponse.json({
      success: true,
      groupName: nuligaData.groupName,
      championship: nuligaData.championship,
      standings: nuligaData.standings.length,
      matches: nuligaData.matches.length,
      teamsCreated,
      teamsUpdated,
      matchesCreated,
      matchesUpdated,
      fetchedAt: nuligaData.fetchedAt,
    });
  });
}

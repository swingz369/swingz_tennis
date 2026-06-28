import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import {
  parseStandingsCsv,
  parseMatchesCsv,
  NuligaCsvParseError,
  type NuligaStanding,
} from '@/lib/services/nuliga-csv-parser';
import { parseNuligaDate, parseScore, type NuligaMatch } from '@/lib/services/nuliga-scraper';

export const dynamic = 'force-dynamic';

const log = createLogger('api:admin:nuliga:import');

// ── Limits ───────────────────────────────────────────────────────────────

const MAX_UPLOAD_BYTES = 1 * 1024 * 1024; // 1 MB pro CSV-Datei

// ── Route ────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/nuliga/import
 *
 * CSV-Import-Fallback für den HTML-Syncronisationspfad (`cron:nuliga-sync`).
 * Wenn der Layout-Scraper fehlschlägt (HTML-Drift, 5xx-Storms, fehlende
 * CSS-Klasse `result-set`), kann ein Admin die nuLiga-Web-Oberfläche
 * manuell als CSV exportieren und hier hochladen.
 *
 * Body: multipart/form-data mit den Feldern
 *   - leagueId     : string (Pflicht)
 *   - standings    : File (Pflicht, <1 MB, UTF-8-CSV mit ; Delimiter)
 *   - matches      : File (Pflicht, <1 MB, UTF-8-CSV mit ; Delimiter)
 *
 * Auth: admin, owner, superadmin (mit Club-Match auf league.club_id).
 *
 * Antwort: JSON mit Import-Counts und Fehler-Pfad.
 *
 * Krisenfall-Doku: docs/runbooks/nuliga-csv-fallback.md
 */
export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    // 1. Rate-Limit (mutativer POST + sensible Admin-Aktion)
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
    if (rateLimitError) return rateLimitError;

    // 2. Rolle: admin oder höher (superadmin/owner haben implizit Zugriff)
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Admin-Berechtigung erforderlich');

    // 3. Multipart-Body parsen (Next.js 16 `request.formData()`).
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        { error: 'Multipart-Body konnte nicht gelesen werden' },
        { status: 400 }
      );
    }

    const leagueId = form.get('leagueId');
    const standingsFile = form.get('standings');
    const matchesFile = form.get('matches');

    if (typeof leagueId !== 'string' || leagueId.length === 0) {
      return NextResponse.json({ error: 'leagueId fehlt' }, { status: 400 });
    }
    if (!(standingsFile instanceof File) || !(matchesFile instanceof File)) {
      return NextResponse.json(
        { error: 'Beide Dateien (standings + matches) sind Pflicht' },
        { status: 400 }
      );
    }
    if (standingsFile.size > MAX_UPLOAD_BYTES || matchesFile.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `CSV-Datei überschreitet ${MAX_UPLOAD_BYTES / 1024 / 1024} MB-Limit` },
        { status: 413 }
      );
    }

    // 4. League-Match (welche Liga gehört zum Club des Auth-Users?)
    const supabase = createServiceClient();
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, club_id, nuliga_url')
      .eq('id', leagueId)
      .maybeSingle();

    if (leagueError) {
      log.error('League-Lookup fehlgeschlagen', leagueError);
      return NextResponse.json({ error: 'Datenbankfehler beim League-Lookup' }, { status: 500 });
    }
    if (!league) {
      return NextResponse.json({ error: 'Liga nicht gefunden' }, { status: 404 });
    }
    // Club-Scope: user darf nur Ligen seines Clubs importieren.
    // Owner/Superadmin dürfen alle Ligen, Admin nur eigene.
    if (auth.role !== 'owner' && auth.role !== 'superadmin' && league.club_id !== auth.clubId) {
      log.warn('Club-Mismatch beim CSV-Import', {
        leagueId,
        actorClub: auth.clubId,
        targetClub: league.club_id,
        actorRole: auth.role,
      });
      return forbiddenResponse('Du kannst nur Ligen im eigenen Verein importieren');
    }

    // 5. CSV-Inhalte lesen als UTF-8 Text. csv-parse/sync erwartet Strings.
    let standingsCsv: string;
    let matchesCsv: string;
    try {
      standingsCsv = await standingsFile.text();
      matchesCsv = await matchesFile.text();
    } catch (err) {
      return NextResponse.json(
        {
          error: 'CSV-Dateien konnten nicht gelesen werden',
          details: err instanceof Error ? err.message : String(err),
        },
        { status: 400 }
      );
    }

    // ── CSV parsen — defensiv isoliert, sodass ein Header-Fehler in
    //    standings.csv NICHT den Match-Pfad blockiert und umgekehrt.
    let standings: NuligaStanding[] = [];
    let matches: NuligaMatch[] = [];
    const parseErrors: string[] = [];
    try {
      standings = parseStandingsCsv(standingsCsv);
    } catch (err) {
      const reason =
        err instanceof NuligaCsvParseError
          ? err.message
          : `standings.csv Parse-Fehler: ${err instanceof Error ? err.message : String(err)}`;
      log.warn(reason, { leagueId });
      parseErrors.push(reason);
    }
    try {
      matches = parseMatchesCsv(matchesCsv);
    } catch (err) {
      const reason =
        err instanceof NuligaCsvParseError
          ? err.message
          : `matches.csv Parse-Fehler: ${err instanceof Error ? err.message : String(err)}`;
      log.warn(reason, { leagueId });
      parseErrors.push(reason);
    }

    if (parseErrors.length === 2 && standings.length === 0 && matches.length === 0) {
      // Beide CSVs fehlerhaft + leeres Ergebnis → nichts zu speichern.
      Sentry.captureMessage('nuliga CSV-Import: beide CSVs fehlerhaft', { level: 'warning' });
      return NextResponse.json(
        {
          error: 'CSV-Parsing fehlgeschlagen für beide Dateien',
          parseErrors,
        },
        { status: 400 }
      );
    }

    const syncStartTime = Date.now();

    // ── 6. Teams upserten (additive insert, ohne match_days zu berühren)
    let teamsCreated = 0;
    let teamsUpdated = 0;

    if (standings.length > 0) {
      const { data: existingTeams } = await supabase
        .from('teams')
        .select(
          'id, name, position, points, matches_played, matches_won, matches_lost, matches_drawn'
        )
        .eq('league_id', leagueId);

      const existingByName = new Map<string, { id: string; [k: string]: unknown }>(
        ((existingTeams ?? []) as Array<{ id: string; name: string }>).map((t) => [
          t.name.trim().toLowerCase(),
          t,
        ])
      );

      for (const standing of standings) {
        const key = standing.teamName.trim().toLowerCase();
        const existing = existingByName.get(key);
        const rowData = {
          position: standing.rank,
          points: standing.points,
          matches_played: standing.matchesPlayed,
          matches_won: standing.wins,
          matches_lost: standing.losses,
          matches_drawn: standing.draws,
        } as const;

        if (existing) {
          const needsUpdate =
            existing.position !== standing.rank ||
            existing.points !== standing.points ||
            existing.matches_played !== standing.matchesPlayed ||
            existing.matches_won !== standing.wins ||
            existing.matches_lost !== standing.losses ||
            existing.matches_drawn !== standing.draws;
          if (needsUpdate) {
            const { error } = await supabase.from('teams').update(rowData).eq('id', existing.id);
            if (error) {
              // Wir loggen und machen weiter — andere Teams ggf. trotzdem aktualisiert.
              log.warn('Team-Update fehlgeschlagen', { teamId: existing.id, error });
            } else {
              teamsUpdated++;
            }
          }
        } else if (league.club_id) {
          const { error } = await supabase.from('teams').insert({
            ...rowData,
            club_id: league.club_id,
            league_id: leagueId,
            name: standing.teamName,
          });
          if (error) {
            log.warn('Team-Insert fehlgeschlagen', { teamName: standing.teamName, error });
          } else {
            teamsCreated++;
          }
        }
      }
    }

    // ── 7. Match-Days upserten (Spielplan)
    let matchesCreated = 0;
    let matchesUpdated = 0;
    let matchdayNum = 0;
    let lastDateKey = '';

    if (matches.length > 0) {
      const { data: existingMatchDays } = await supabase
        .from('match_days')
        .select('id, matchday_number, opponent, scheduled_date, status, score_home, score_away')
        .eq('league_id', leagueId);

      const existingMatchMap = new Map<string, { id: string; [k: string]: unknown }>();
      for (const md of (existingMatchDays ?? []) as Array<{
        id: string;
        opponent: string;
        scheduled_date: string | null;
      }>) {
        const mk = `${md.opponent}|${md.scheduled_date || ''}`.toLowerCase();
        existingMatchMap.set(mk, md);
      }

      for (const match of matches) {
        const dateKey = match.date;
        if (dateKey !== lastDateKey) {
          matchdayNum++;
          lastDateKey = dateKey;
        }

        const parsedDate = parseNuligaDate(match.date);
        const scores = parseScore(match.matchPoints);

        let result: string | null = null;
        if (match.status === 'completed' && scores) {
          result = scores.home > scores.away ? 'win' : scores.home < scores.away ? 'loss' : 'draw';
        }

        const homeKey = `${match.homeTeam}|${parsedDate || ''}`.toLowerCase();
        const awayKey = `${match.awayTeam}|${parsedDate || ''}`.toLowerCase();
        const existing = existingMatchMap.get(homeKey) || existingMatchMap.get(awayKey);

        const matchData = {
          scheduled_date: parsedDate,
          opponent: match.homeTeam,
          is_home: true,
          venue: null,
          result,
          score_home: scores?.home ?? null,
          score_away: scores?.away ?? null,
          status: match.status === 'completed' ? 'completed' : 'pending',
          notes: `vs ${match.awayTeam}${match.matchPoints ? ` (${match.matchPoints})` : ''}`,
        } as const;

        if (existing) {
          const needsUpdate =
            existing.status !== matchData.status ||
            existing.score_home !== matchData.score_home ||
            existing.score_away !== matchData.score_away;
          if (needsUpdate) {
            const { error } = await supabase
              .from('match_days')
              .update(matchData)
              .eq('id', existing.id);
            if (error) {
              log.warn('MatchDay-Update fehlgeschlagen', {
                matchdayId: (existing as { id: string }).id,
                error,
              });
            } else {
              matchesUpdated++;
            }
          }
        } else {
          const { error } = await supabase.from('match_days').insert({
            ...matchData,
            league_id: leagueId,
            matchday_number: matchdayNum,
          });
          if (error) {
            log.warn('MatchDay-Insert fehlgeschlagen', { opponent: match.homeTeam, error });
          } else {
            matchesCreated++;
          }
        }
      }
    }

    // 8. last_synced_at aktualisieren (semantisch: "letzter Sync-Versuch")
    await supabase
      .from('leagues')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', leagueId);

    // 9. Audit-Log in nuliga_sync_log mit trigger='csv_import' (separiert vom Cron-Sync)
    if (league.club_id) {
      await supabase.from('nuliga_sync_log').insert({
        league_id: leagueId,
        club_id: league.club_id,
        status: parseErrors.length > 0 ? 'partial' : 'success',
        trigger: 'csv_import',
        teams_created: teamsCreated,
        teams_updated: teamsUpdated,
        matches_created: matchesCreated,
        matches_updated: matchesUpdated,
        nuliga_url: league.nuliga_url ?? '(csv-import)',
        nuliga_group_name: null,
        nuliga_championship: null,
        started_at: new Date(syncStartTime).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - syncStartTime,
        ...(parseErrors.length > 0 ? { error_message: parseErrors.join(' | ') } : {}),
      });
    }

    log.info('nuLiga CSV-Import abgeschlossen', {
      leagueId,
      teamsCreated,
      teamsUpdated,
      matchesCreated,
      matchesUpdated,
      parseErrors: parseErrors.length,
    });

    // 10. Response (statisch geformter Service-Output für Admin-Dry-Run-Echo)
    return NextResponse.json({
      success: true,
      leagueId,
      teams: { created: teamsCreated, updated: teamsUpdated, parsed: standings.length },
      matches: { created: matchesCreated, updated: matchesUpdated, parsed: matches.length },
      parseErrors: parseErrors.length > 0 ? parseErrors : undefined,
      durationMs: Date.now() - syncStartTime,
    });
  });
}

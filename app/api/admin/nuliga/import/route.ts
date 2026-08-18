/**
 * POST /api/admin/nuliga/import
 * 1.3.3 — CSV-Import-Fallback: Tabelle (standings) + Spielplan (matches)
 * Multipart, 1 MB cap, idempotenter Upsert.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import {
  parseStandingsCsv,
  parseMatchesCsv,
  NuligaCsvParseError,
} from '@/lib/services/nuliga-csv-parser';

const log = createLogger('api:admin:nuliga:import');
const MAX_BYTES = 1_048_576; // 1 MB

async function readFilePart(part: File): Promise<string> {
  if (part.size > MAX_BYTES) throw new Error(`Datei zu groß (max 1 MB): ${part.name}`);
  return part.text();
}

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const canImport =
      (await verifyRole(auth, 'admin')) ||
      (await verifyRole(auth, 'superadmin')) ||
      (await verifyRole(auth, 'owner'));
    if (!canImport) return forbiddenResponse('Admin-Zugriff erforderlich');

    const form = await req.formData();
    const leagueId = form.get('leagueId') as string | null;
    const teamName = (form.get('teamName') as string | null) ?? '';
    const standingsFile = form.get('standings') as File | null;
    const matchesFile = form.get('matches') as File | null;

    if (!leagueId) return NextResponse.json({ error: 'leagueId fehlt' }, { status: 400 });

    const sb = createServiceClient();
    let standingsImported = 0;
    let matchesImported = 0;

    try {
      if (standingsFile) {
        const csv = await readFilePart(standingsFile);
        const rows = parseStandingsCsv(csv);
        // EIN Upsert für alle Zeilen statt N Einzel-Queries (idempotent über
        // den natürlichen Schlüssel league_id + name).
        const { error } = await sb.from('teams').upsert(
          rows.map((row) => ({
            league_id: leagueId,
            club_id: auth.clubId!,
            name: row.name,
            position: row.rank,
            matches_played: row.matchesPlayed,
            matches_won: row.wins,
            matches_drawn: row.draws,
            matches_lost: row.losses,
            points: row.points,
          })),
          { onConflict: 'league_id,name' }
        );
        if (error) throw new Error(`Tabellen-Import fehlgeschlagen: ${error.message}`);
        standingsImported = rows.length;
      }

      if (matchesFile) {
        const csv = await readFilePart(matchesFile);
        const rows = parseMatchesCsv(csv, teamName);
        // EIN Upsert für alle Zeilen statt N Einzel-Queries.
        const { error } = await sb.from('match_days').upsert(
          rows.map((row) => ({
            league_id: leagueId,
            matchday_number: row.matchdayNumber,
            opponent: row.opponent,
            scheduled_date: row.scheduledDate?.toISOString() ?? null,
            is_home: row.isHome,
            status: 'scheduled',
          })),
          { onConflict: 'league_id,matchday_number' }
        );
        if (error) throw new Error(`Spielplan-Import fehlgeschlagen: ${error.message}`);
        matchesImported = rows.length;
      }

      void (async () => {
        try {
          await sb.from('nuliga_sync_log').insert({
            league_id: leagueId,
            club_id: auth.clubId!,
            trigger: 'csv_import',
            status: 'success',
            teams_created: standingsImported,
            matches_created: matchesImported,
            nuliga_url: '',
            started_at: new Date().toISOString(),
          });
        } catch (err) {
          log.error('sync_log insert failed', err instanceof Error ? err : undefined);
        }
      })();

      return NextResponse.json({ standingsImported, matchesImported });
    } catch (err) {
      // Nur der CSV-Parsefehler ist fuer den Nutzer formuliert und sagt ihm,
      // was an seiner Datei nicht stimmt. Alles andere (DB, Netz) wuerde
      // interne Details durchreichen.
      const msg = err instanceof NuligaCsvParseError ? err.message : 'Import fehlgeschlagen';
      log.error('nuliga csv import error', err instanceof Error ? err : undefined);
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  });
}

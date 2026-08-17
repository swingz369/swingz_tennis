import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

/**
 * POST /api/leagues/[id]/import — Import match results from CSV
 *
 * Expected CSV format (semicolon-separated):
 * Spieltag;Datum;Gegner;Heim/Auswärts;Ergebnis;Punkte Heim;Punkte Gast;Status
 *
 * - If a matchday with the same matchday_number exists, it will be updated
 * - If not, a new matchday will be created
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Zugriff nur für Admins');

    const { id } = await params;

    // Verify league exists
    const { data: league } = await auth.supabase.from('leagues').select('id').eq('id', id).single();

    if (!league) {
      return NextResponse.json({ error: 'Liga nicht gefunden' }, { status: 404 });
    }

    let csvText: string;
    try {
      const body = await request.json();
      csvText = body.csv;
      if (!csvText || typeof csvText !== 'string') {
        return NextResponse.json({ error: 'CSV-Daten fehlen' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Ungültiger Request Body' }, { status: 400 });
    }

    // Parse CSV
    const lines = csvText.split('\n').filter((l: string) => {
      const trimmed = l.trim();
      return trimmed.length > 0 && !trimmed.startsWith('#');
    });

    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV enthält keine Datenzeilen' }, { status: 400 });
    }

    // Detect separator (tab or semicolon)
    const headerLine = lines[0];
    const separator = headerLine.includes('\t') ? '\t' : ';';

    const headers = headerLine.split(separator).map((h: string) => h.trim().toLowerCase());

    // Map German result labels
    const resultMap: Record<string, string> = {
      sieg: 'win',
      win: 'win',
      niederlage: 'loss',
      loss: 'loss',
      unentschieden: 'draw',
      draw: 'draw',
    };

    const statusMap: Record<string, string> = {
      abgeschlossen: 'completed',
      completed: 'completed',
      ausstehend: 'pending',
      pending: 'pending',
    };

    const dataLines = lines.slice(1);
    let imported = 0;
    let updated = 0;
    let created = 0;
    const errors: string[] = [];

    // Fetch existing match days for this league
    const { data: existingMatchDays } = await auth.supabase
      .from('match_days')
      .select('id, matchday_number')
      .eq('league_id', id);

    const existingByNumber = new Map<number, string>(
      (existingMatchDays ?? []).map((md: any) => [md.matchday_number, md.id])
    );

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) continue;

      try {
        const cols = line.split(separator).map((c: string) => c.trim());
        const getValue = (name: string) => {
          const idx = headers.indexOf(name);
          return idx >= 0 ? (cols[idx] ?? '') : '';
        };

        const matchdayNumber = parseInt(getValue('spieltag'), 10);
        if (isNaN(matchdayNumber) || matchdayNumber < 1) {
          errors.push(`Zeile ${i + 2}: Ungültige Spieltag-Nummer`);
          continue;
        }

        const dateStr = getValue('datum');
        const opponent = getValue('gegner');
        if (!opponent) {
          errors.push(`Zeile ${i + 2}: Gegner fehlt`);
          continue;
        }

        const heimAuswaerts = getValue('heim/auswärts').toLowerCase();
        const isHome = heimAuswaerts.includes('heim') || heimAuswaerts === 'home';

        const venue = getValue('spielort') || null;

        const resultRaw = getValue('ergebnis').toLowerCase();
        const result = resultMap[resultRaw] || null;

        const scoreHome = getValue('punkte heim');
        const scoreAway = getValue('punkte gast');

        const statusRaw = getValue('status').toLowerCase();
        const status = statusMap[statusRaw] || (result ? 'completed' : 'pending');

        const notes = getValue('notizen') || null;

        const rowData: Record<string, unknown> = {
          matchday_number: matchdayNumber,
          scheduled_date: dateStr || null,
          opponent,
          is_home: isHome,
          venue,
          result,
          score_home: scoreHome ? parseInt(scoreHome, 10) : null,
          score_away: scoreAway ? parseInt(scoreAway, 10) : null,
          status,
          notes,
        };

        const existingId = existingByNumber.get(matchdayNumber);
        if (existingId) {
          // Update existing
          const { error } = await auth.supabase
            .from('match_days')
            .update(rowData as never)
            .eq('id', existingId);

          if (error) {
            errors.push(`Zeile ${i + 2}: Update fehlgeschlagen — ${error.message}`);
            continue;
          }
          updated++;
        } else {
          // Create new
          const { error } = await auth.supabase
            .from('match_days')
            .insert({ ...rowData, league_id: id } as never);

          if (error) {
            errors.push(`Zeile ${i + 2}: Erstellen fehlgeschlagen — ${error.message}`);
            continue;
          }
          created++;
        }
        imported++;
      } catch {
        errors.push(`Zeile ${i + 2}: Parse-Fehler`);
      }
    }

    return NextResponse.json({
      imported,
      updated,
      created,
      errors: errors.length > 0 ? errors : undefined,
      total: dataLines.length,
    });
  });
}

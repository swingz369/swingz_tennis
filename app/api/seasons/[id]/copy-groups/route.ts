import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:copy-groups');

// POST /api/seasons/[id]/copy-groups
// Body: { sourceSeasonId: string }
//
// Übernimmt den Stundenplan einer früheren Saison: jeder `season_plan_entry`
// der Quell-Saison wird als Entwurf in die Ziel-Saison kopiert.
//
// Die Route hiess einmal „Gruppen kopieren" und las aus `training_groups` —
// einer zweiten, nie befüllten Tabelle, weshalb sie ausnahmslos mit 404
// antwortete (siehe docs/ARCHIV/2026-08-28-grundfunktionen-harmonisierung.md,
// F-6). Gruppen selbst sind club-weit (`groups`, ohne `season_id`); sie zu
// kopieren wäre ein No-op, die Ziel-Saison sieht sie ohnehin alle. Was der
// Admin an dieser Stelle übernehmen will, ist die Belegung: wer unterrichtet
// wann, wo, mit welcher Gruppe.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return forbiddenResponse('Admin-Zugang erforderlich');
    }

    const { id: targetSeasonId } = await params;
    const body = await req.json();
    const { sourceSeasonId } = body ?? {};

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(targetSeasonId) || !uuidRegex.test(sourceSeasonId ?? '')) {
      return NextResponse.json({ error: 'Ungültige Season-ID' }, { status: 400 });
    }

    if (sourceSeasonId === targetSeasonId) {
      return NextResponse.json(
        { error: 'Quell- und Ziel-Saison dürfen nicht identisch sein' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Ziel-Saison laden und Club-Zugehörigkeit prüfen
    const { data: targetSeason, error: targetErr } = await supabase
      .from('seasons')
      .select('id, club_id, name')
      .eq('id', targetSeasonId)
      .single();

    if (targetErr || !targetSeason) {
      return NextResponse.json({ error: 'Ziel-Saison nicht gefunden' }, { status: 404 });
    }

    if (auth.role !== 'superadmin' && targetSeason.club_id !== auth.clubId) {
      return forbiddenResponse('Keine Berechtigung für diese Saison');
    }

    // Quell-Saison laden
    const { data: sourceSeason, error: sourceErr } = await supabase
      .from('seasons')
      .select('id, club_id, name')
      .eq('id', sourceSeasonId)
      .single();

    if (sourceErr || !sourceSeason) {
      return NextResponse.json({ error: 'Quell-Saison nicht gefunden' }, { status: 404 });
    }

    // Beide Saisons müssen zum gleichen Verein gehören (außer superadmin)
    if (auth.role !== 'superadmin' && sourceSeason.club_id !== targetSeason.club_id) {
      return forbiddenResponse('Quell- und Ziel-Saison müssen zum gleichen Verein gehören');
    }

    // Stundenplan-Einträge der Quell-Saison laden
    // Feldliste als eine Zeichenkette: setzt man sie aus Teilen zusammen, kann
    // der Supabase-Typgenerator die Spalten nicht mehr auflösen.
    const { data: sourceEntries, error: entriesErr } = await supabase
      .from('season_plan_entries')
      .select(
        'trainer_id, court_id, group_id, day_of_week, day_of_week_2, start_time, end_time, duration_minutes, entry_type, max_participants, expected_participants, sessions_per_week, starts_from_week, ends_at_week, notes'
      )
      .eq('season_id', sourceSeasonId);

    if (entriesErr) {
      log.error('Fehler beim Laden der Quell-Einträge', entriesErr);
      return NextResponse.json({ error: 'Fehler beim Laden der Quell-Saison' }, { status: 500 });
    }

    if (!sourceEntries?.length) {
      return NextResponse.json(
        { error: 'Die Quell-Saison hat noch keine Stundenplan-Einträge' },
        { status: 404 }
      );
    }

    // Nicht zweimal übernehmen: hat die Ziel-Saison schon einen Plan, würde ein
    // zweiter Klick ihn verdoppeln statt ihn zu ersetzen.
    const { count: existing } = await supabase
      .from('season_plan_entries')
      .select('id', { count: 'exact', head: true })
      .eq('season_id', targetSeasonId);

    if (existing && existing > 0) {
      return NextResponse.json(
        {
          error:
            'Die Ziel-Saison hat bereits Stundenplan-Einträge. Bitte zuerst leeren, dann übernehmen.',
        },
        { status: 409 }
      );
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('season_plan_entries')
      .insert(
        sourceEntries.map((e) => ({
          ...e,
          season_id: targetSeasonId,
          club_id: targetSeason.club_id,
          // Übernommen heisst Entwurf: der Admin sieht den Plan, bevor er ihn
          // veröffentlicht — nichts wird still aktiv.
          status: 'planned',
          planning_source: 'copied',
        }))
      )
      .select('id');

    if (insertErr) {
      log.error('Fehler beim Kopieren der Stundenplan-Einträge', insertErr);
      return NextResponse.json(
        { error: 'Fehler beim Übernehmen des Stundenplans' },
        { status: 500 }
      );
    }

    const copiedEntries = inserted?.length ?? 0;
    const copiedGroups = new Set(sourceEntries.map((e) => e.group_id).filter(Boolean)).size;

    log.info('Stundenplan übernommen', { sourceSeasonId, targetSeasonId, copiedEntries });

    return NextResponse.json({ copiedEntries, copiedGroups });
  });
}

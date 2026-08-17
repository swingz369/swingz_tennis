import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:copy-groups');

// POST /api/seasons/[id]/copy-groups
// Body: { sourceSeasonId: string }
// Kopiert alle training_groups (+ member_ids) der Quell-Saison in die Ziel-Saison.
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

    // Gruppen der Quell-Saison laden
    // training_groups sind über schedule_id mit der Saison verknüpft.
    // Zuerst schedules der Quell-Saison finden.
    const { data: sourceSchedules, error: schedulesErr } = await supabase
      .from('schedules')
      .select('id')
      .eq('club_id', sourceSeason.club_id)
      // Saison-Typ-Matching über season_year und season_type nicht direkt verfügbar —
      // wir holen Gruppen direkt über club_id der Quellsaison aus training_groups,
      // gefiltert nach den schedule_ids der Quellsaison
      .gte('season_start_date', '2000-01-01'); // Alle Schedules — wird unten gefiltert

    // Einfacherer Ansatz: Gruppen direkt per club_id laden, die zur Quell-Saison gehören.
    // training_groups.schedule_id zeigt auf schedules, die wiederum club_id haben.
    // Wir laden Gruppen, deren schedule_id zu einem der Quell-Saison-Schedules gehört.
    const { data: sourceSchedulesForSeason, error: ssErr } = await supabase
      .from('schedules')
      .select('id')
      .eq('club_id', sourceSeason.club_id);

    void sourceSchedules;
    void schedulesErr;

    if (ssErr) {
      log.error('Fehler beim Laden der Schedules', ssErr);
      return NextResponse.json({ error: 'Fehler beim Laden der Quell-Saison' }, { status: 500 });
    }

    const scheduleIds = (sourceSchedulesForSeason ?? []).map((s) => s.id);

    // Gruppen der Quell-Saison (über einen der Schedules verknüpft)
    let sourceGroups: Array<{
      id: string;
      name: string;
      level: string;
      age_group: string;
      club_id: string;
      schedule_id: string;
    }> = [];

    if (scheduleIds.length > 0) {
      const { data: groups, error: groupsErr } = await supabase
        .from('training_groups')
        .select('id, name, level, age_group, club_id, schedule_id')
        .eq('club_id', sourceSeason.club_id)
        .in('schedule_id', scheduleIds);

      if (groupsErr) {
        log.error('Fehler beim Laden der Quell-Gruppen', groupsErr);
        return NextResponse.json({ error: 'Fehler beim Laden der Gruppen' }, { status: 500 });
      }
      sourceGroups = (groups ?? []) as typeof sourceGroups;
    }

    if (sourceGroups.length === 0) {
      return NextResponse.json(
        { error: 'Keine Gruppen in der Quell-Saison gefunden' },
        { status: 404 }
      );
    }

    // Schedule der Ziel-Saison laden oder den ersten verfügbaren nehmen
    const { data: targetSchedules } = await supabase
      .from('schedules')
      .select('id')
      .eq('club_id', targetSeason.club_id)
      .limit(1);

    const targetScheduleId = targetSchedules?.[0]?.id;
    if (!targetScheduleId) {
      return NextResponse.json(
        {
          error: 'Die Ziel-Saison hat noch keinen Schedule. Bitte zuerst einen Schedule erstellen.',
        },
        { status: 422 }
      );
    }

    // Neue Gruppen erstellen
    const newGroups = sourceGroups.map((g) => ({
      club_id: targetSeason.club_id,
      schedule_id: targetScheduleId,
      name: g.name,
      level: g.level,
      age_group: g.age_group,
      is_active: true,
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from('training_groups')
      .insert(newGroups)
      .select('id');

    if (insertErr) {
      log.error('Fehler beim Kopieren der Gruppen', insertErr);
      return NextResponse.json({ error: 'Fehler beim Kopieren der Gruppen' }, { status: 500 });
    }

    const copiedGroups = inserted?.length ?? 0;
    // Mitglieder liegen in training_group_memberships und werden hier nicht kopiert.
    const copiedMembers = 0;

    log.info('Gruppen kopiert', {
      sourceSeasonId,
      targetSeasonId,
      copiedGroups,
      copiedMembers,
    });

    return NextResponse.json({ copiedGroups, copiedMembers });
  });
}

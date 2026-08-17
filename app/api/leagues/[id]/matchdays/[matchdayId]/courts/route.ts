/**
 * app/api/leagues/[id]/matchdays/[matchdayId]/courts/route.ts
 *
 * POST   — Plätze für ein Heimspiel sperren (eine court_closure je Platz)
 * DELETE — Sperre wieder aufheben
 *
 * Die Sperren hängen über `court_closures.match_day_id` am Spieltag: wird der
 * Spieltag gelöscht, gibt die DB die Plätze per ON DELETE CASCADE frei.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, verifyOffice, forbiddenResponse } from '@/lib/api-auth';
import type { AuthContext } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';
import { berlinWallClock } from '@/lib/berlin-time';

const log = createLogger('api:leagues:matchday-courts');

type Params = { params: Promise<{ id: string; matchdayId: string }> };

/** Medenspiele dauern einen halben bis ganzen Tag; ohne Endzeit sperren wir bis 20:00. */
const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 20;

export async function POST(request: NextRequest, { params }: Params) {
  return withApiAuth(request, async (auth) => {
    const canEdit =
      (await verifyRole(auth, 'admin')) || (await verifyOffice(auth, 'mannschaftsfuehrer'));
    if (!canEdit) return forbiddenResponse('Admin- oder Mannschaftsführer-Zugang erforderlich');
    if (!auth.clubId) return forbiddenResponse('Vereinskontext erforderlich');
    const clubId = auth.clubId;

    const { id: leagueId, matchdayId } = await params;

    const { data: league } = await auth.supabase
      .from('leagues')
      .select('id, name')
      .eq('id', leagueId)
      .eq('club_id', clubId)
      .maybeSingle();
    if (!league) return NextResponse.json({ error: 'Liga nicht gefunden' }, { status: 404 });

    const { data: matchDay } = await auth.supabase
      .from('match_days')
      .select('id, opponent, is_home, scheduled_date')
      .eq('id', matchdayId)
      .eq('league_id', leagueId)
      .maybeSingle();
    if (!matchDay) return NextResponse.json({ error: 'Spieltag nicht gefunden' }, { status: 404 });

    if (!matchDay.is_home) {
      return NextResponse.json({ error: 'Nur Heimspiele belegen eigene Plätze.' }, { status: 400 });
    }
    if (!matchDay.scheduled_date) {
      return NextResponse.json(
        { error: 'Der Spieltag hat kein Datum — bitte zuerst ein Datum eintragen.' },
        { status: 400 }
      );
    }

    // Schon gesperrt? Dann nichts doppelt anlegen.
    const { data: existing } = await auth.supabase
      .from('court_closures')
      .select('id')
      .eq('match_day_id', matchdayId);
    const existingCount = (existing ?? []).length;
    if (existingCount > 0) {
      return NextResponse.json({ success: true, created: 0, alreadyBlocked: existingCount });
    }

    const { data: courts } = await auth.supabase
      .from('courts')
      .select('id')
      .eq('club_id', clubId)
      .eq('is_active', true);

    if (!courts || courts.length === 0) {
      return NextResponse.json({ error: 'Keine aktiven Plätze vorhanden' }, { status: 400 });
    }

    // Uhrzeit aus dem Spieltermin übernehmen, wenn eine gesetzt ist; sonst 9 Uhr.
    const start = new Date(matchDay.scheduled_date);
    const hasTime = start.getUTCHours() !== 0 || start.getUTCMinutes() !== 0;
    const startDate = hasTime ? start : berlinWallClock(start, DEFAULT_START_HOUR, 0);
    const endDate = berlinWallClock(start, DEFAULT_END_HOUR, 0);

    const body = await request.json().catch(() => ({}));
    const rows = courts.map((c: { id: string }) => ({
      club_id: clubId,
      court_id: c.id,
      match_day_id: matchdayId,
      reason: 'event',
      description: `Medenspiel: ${league.name} gegen ${matchDay.opponent}`,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      auto_generated: true,
      created_by: auth.user.id,
    }));

    const { error } = await auth.supabase.from('court_closures').insert(rows);
    if (error) {
      log.error('Platzsperre fehlgeschlagen', { matchdayId, error: error.message });
      return NextResponse.json({ error: 'Plätze konnten nicht gesperrt werden' }, { status: 500 });
    }

    // Mitglieder informieren, wenn gewünscht (gleiche Konvention wie /api/weather/closures).
    if (body?.notify_members) {
      await notifyMembers(auth, clubId, league.name, matchDay.opponent, startDate);
    }

    return NextResponse.json({ success: true, created: rows.length });
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return withApiAuth(request, async (auth) => {
    const canEdit =
      (await verifyRole(auth, 'admin')) || (await verifyOffice(auth, 'mannschaftsfuehrer'));
    if (!canEdit) return forbiddenResponse('Admin- oder Mannschaftsführer-Zugang erforderlich');
    if (!auth.clubId) return forbiddenResponse('Vereinskontext erforderlich');

    const { matchdayId } = await params;

    const { error } = await auth.supabase
      .from('court_closures')
      .delete()
      .eq('match_day_id', matchdayId)
      .eq('club_id', auth.clubId);

    if (error) {
      return NextResponse.json({ error: 'Sperre konnte nicht aufgehoben werden' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  });
}

async function notifyMembers(
  auth: AuthContext,
  clubId: string,
  leagueName: string,
  opponent: string,
  start: Date
): Promise<void> {
  try {
    const sb = auth.supabase;
    const { data: members } = await sb
      .from('user_club_memberships')
      .select('user_id')
      .eq('club_id', clubId)
      .eq('is_active', true);

    if (!members || members.length === 0) return;

    const datum = start.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Europe/Berlin',
    });

    await sb.from('notifications').insert(
      members.map((m: { user_id: string }) => ({
        user_id: m.user_id,
        club_id: clubId,
        // 'warning' statt eines eigenen Typs — notifications_type_check lässt
        // nur die dort gelisteten Werte zu (Migration 20260813090000).
        type: 'warning',
        title: 'Plätze belegt',
        message: `Am ${datum} sind die Plätze wegen des Heimspiels ${leagueName} gegen ${opponent} belegt.`,
        action_url: '/member',
      }))
    );
  } catch (err) {
    log.error('Benachrichtigung fehlgeschlagen', err instanceof Error ? err : undefined);
  }
}

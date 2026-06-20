/**
 * GET  /api/admin/members/[memberId]/absences
 *   Zählt no_show-Bookings des Mitglieds der letzten 60 Tage.
 *
 * POST /api/admin/members/[memberId]/absences
 *   Manuelles Auslösen der Trainer-Benachrichtigung (Admin).
 *
 * Auth: admin oder superadmin
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:admin:members:absences');

const LOOKBACK_DAYS = 60;

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse('Admin-Zugang erforderlich');

    const { memberId } = await params;
    const { searchParams } = new URL(req.url);
    const clubId = searchParams.get('clubId') ?? auth.clubId;

    if (!clubId) {
      return NextResponse.json({ error: 'clubId fehlt' }, { status: 400 });
    }

    const since = new Date();
    since.setDate(since.getDate() - LOOKBACK_DAYS);

    // Use the auth supabase client (RLS active)
    const supabase = auth.supabase as ReturnType<typeof createServiceClient>;

    const { data: noShows, error } = await (supabase as any)
      .from('bookings')
      .select('id, session_start_time, booked_at, cancellation_reason')
      .eq('member_id', memberId)
      .eq('club_id', clubId)
      .eq('status', 'no_show')
      .gte('created_at', since.toISOString())
      .order('session_start_time', { ascending: false });

    if (error) {
      log.error('Fehlzeiten-Abfrage fehlgeschlagen', error instanceof Error ? error : undefined);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      memberId,
      clubId,
      lookbackDays: LOOKBACK_DAYS,
      noShowCount: (noShows ?? []).length,
      noShows: noShows ?? [],
    });
  });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse('Admin-Zugang erforderlich');

    const { memberId } = await params;
    const body = (await req.json().catch(() => null)) as { clubId?: string } | null;
    const clubId = body?.clubId ?? auth.clubId;

    if (!clubId) {
      return NextResponse.json({ error: 'clubId fehlt' }, { status: 400 });
    }

    const service = createServiceClient();
    const since = new Date();
    since.setDate(since.getDate() - LOOKBACK_DAYS);

    // Mitglied auflösen für sprechende Benachrichtigung
    const { data: memberUser } = await (service as any)
      .from('users')
      .select('full_name, email')
      .eq('id', memberId)
      .single();

    const memberLabel =
      memberUser?.full_name || memberUser?.email || `Mitglied ${memberId.slice(0, 8)}`;

    // Trainer des Vereins ermitteln (alle Trainer des Clubs)
    const { data: trainerRows, error: trainerErr } = await (service as any)
      .from('trainer_club')
      .select('trainer_id, trainers(user_id, name)')
      .eq('club_id', clubId);

    if (trainerErr) {
      log.error(
        'Trainer-Abfrage fehlgeschlagen',
        trainerErr instanceof Error ? trainerErr : undefined
      );
      return NextResponse.json({ error: trainerErr.message }, { status: 500 });
    }

    const notifiedTrainers: string[] = [];

    for (const row of trainerRows ?? []) {
      const trainer = Array.isArray(row.trainers) ? row.trainers[0] : row.trainers;
      if (!trainer?.user_id) continue;

      const { error: notifErr } = await (service as any).from('notifications').insert({
        user_id: trainer.user_id,
        club_id: clubId,
        type: 'absence_alert',
        title: 'Häufige Fehlzeiten',
        message: `${memberLabel} war mehrfach unentschuldigt abwesend. Bitte Kontakt aufnehmen.`,
        read: false,
      });

      if (notifErr) {
        log.error(
          'Benachrichtigung konnte nicht erstellt werden',
          notifErr instanceof Error ? notifErr : undefined
        );
      } else {
        notifiedTrainers.push(trainer.name ?? trainer.user_id);
      }
    }

    log.info('Fehlzeiten-Benachrichtigung manuell ausgelöst', {
      memberId,
      clubId,
      notifiedCount: notifiedTrainers.length,
    });

    return NextResponse.json({
      success: true,
      memberId,
      notifiedTrainers,
    });
  });
}

/**
 * POST /api/bookings/[id]/reactivate
 *
 * Macht eine Abmeldung rückgängig. Bis dahin war eine versehentliche Abmeldung
 * eine Einbahnstraße: Die Buchung stand auf `cancelled`, und keine Oberfläche
 * konnte sie zurückholen — das Mitglied musste beim Admin anrufen.
 *
 * Der Platz wird nur zurückgegeben, wenn er noch frei ist. Zwischen Abmeldung und
 * Reue kann jemand von der Termin-Warteliste nachgerückt sein; ein stilles
 * Wiederherstellen würde die Einheit überbuchen.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:bookings:[id]:reactivate');

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    const isMember = await verifyRole(auth, 'member');
    if (!isMember) return forbiddenResponse('Member access required');

    const { id } = await params;
    const sb = createServiceClient() as any;

    const { data: booking } = await sb
      .from('bookings')
      .select('id, member_id, club_id, session_id, status, session_start_time')
      .eq('id', id)
      .maybeSingle();

    if (!booking) {
      return NextResponse.json({ error: 'Buchung nicht gefunden' }, { status: 404 });
    }

    const isOwner = booking.member_id === auth.user.id;
    const isAdmin = await verifyRole(auth, 'admin');
    if (!isOwner && !isAdmin) {
      return forbiddenResponse('Keine Berechtigung für diese Buchung');
    }

    if (booking.status !== 'cancelled') {
      return NextResponse.json({ error: 'Diese Buchung ist nicht storniert' }, { status: 409 });
    }

    if (booking.session_start_time && new Date(booking.session_start_time) < new Date()) {
      return NextResponse.json({ error: 'Der Termin liegt in der Vergangenheit' }, { status: 409 });
    }

    // Ist der Platz inzwischen vergeben? `max_participants` steht am Planeintrag
    // der Einheit; fehlt er, gilt die Einheit als unbegrenzt.
    if (booking.session_id) {
      const { data: session } = await sb
        .from('sessions')
        .select('plan_entry_id')
        .eq('id', booking.session_id)
        .maybeSingle();

      const { count: activeCount } = await sb
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', booking.session_id)
        .neq('status', 'cancelled');

      if (session?.plan_entry_id) {
        const { data: entry } = await sb
          .from('season_plan_entries')
          .select('max_participants')
          .eq('id', session.plan_entry_id)
          .maybeSingle();

        const max = entry?.max_participants ?? null;
        if (max !== null && (activeCount ?? 0) >= max) {
          return NextResponse.json(
            {
              error:
                'Der Platz ist inzwischen vergeben — bitte beim Trainer oder in der Geschäftsstelle melden.',
            },
            { status: 409 }
          );
        }
      }
    }

    const { error: updateError } = await sb
      .from('bookings')
      .update({ status: 'confirmed', cancelled_at: null, cancellation_reason: null })
      .eq('id', id);

    if (updateError) {
      log.error('Reaktivierung fehlgeschlagen', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Der Trainer hat die Abmeldung als Benachrichtigung bekommen — die Rücknahme
    // gehört genauso gemeldet, sonst plant er ohne dieses Mitglied.
    if (booking.session_id) {
      try {
        const { data: session } = await sb
          .from('sessions')
          .select('trainer_id, timeslot_start')
          .eq('id', booking.session_id)
          .maybeSingle();

        if (session?.trainer_id) {
          const [{ data: trainer }, { data: member }] = await Promise.all([
            sb.from('trainers').select('user_id').eq('id', session.trainer_id).maybeSingle(),
            sb.from('users').select('full_name').eq('id', booking.member_id).maybeSingle(),
          ]);

          if (trainer?.user_id) {
            const termin = session.timeslot_start
              ? new Date(`${session.timeslot_start}Z`).toLocaleString('de-DE', {
                  timeZone: 'Europe/Berlin',
                  dateStyle: 'short',
                  timeStyle: 'short',
                })
              : 'einem Training';
            await sb.from('notifications').insert({
              user_id: trainer.user_id,
              club_id: booking.club_id,
              type: 'booking_reactivated',
              title: 'Abmeldung zurückgenommen',
              message: `${member?.full_name ?? 'Ein Mitglied'} nimmt doch am Training am ${termin} teil.`,
              read: false,
            });
          }
        }
      } catch (notifyErr) {
        log.error(
          'Trainer-Benachrichtigung zur Rücknahme fehlgeschlagen',
          notifyErr instanceof Error ? notifyErr : undefined
        );
      }
    }

    log.info('Buchung reaktiviert', { bookingId: id, memberId: booking.member_id });
    return NextResponse.json({ success: true });
  });
}

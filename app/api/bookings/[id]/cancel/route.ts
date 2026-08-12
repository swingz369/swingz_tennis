/**
 * POST /api/bookings/[id]/cancel — Buchung stornieren
 *
 * Nach erfolgreicher Stornierung wird automatisch geprüft ob jemand
 * auf der Warteliste steht. Wenn ja, rückt Position 1 automatisch nach
 * und erhält eine Benachrichtigung.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { LastMinuteAlertService } from '@/lib/services/last-minute-alert.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:bookings:cancel');

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Authentication required');

    const { id: bookingId } = await params;
    const supabase = auth.supabase;

    // Fetch booking to verify ownership — including session_id for waitlist promotion
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select(
        'id, member_id, status, session_start_time, club_id, session_id, schedule_id, court_id'
      )
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Buchung nicht gefunden' }, { status: 404 });
    }

    // Only own bookings or admin
    const isAdmin = await verifyRole(auth, 'admin');
    if (booking.member_id !== auth.user.id && !isAdmin) {
      return forbiddenResponse('Nicht berechtigt diese Buchung zu stornieren');
    }

    if (booking.status === 'cancelled') {
      return NextResponse.json({ error: 'Buchung ist bereits storniert' }, { status: 409 });
    }

    // Check cancellation rules
    if (!isAdmin && booking.session_start_time) {
      const { data: rules } = await supabase
        .from('booking_rules')
        .select('cancellation_hours_before')
        .eq('club_id', booking.club_id)
        .eq('applies_to_role', 'member')
        .maybeSingle();

      if (rules?.cancellation_hours_before) {
        const sessionTime = new Date(booking.session_start_time).getTime();
        const hoursUntil = (sessionTime - Date.now()) / (1000 * 60 * 60);
        if (hoursUntil < rules.cancellation_hours_before) {
          return NextResponse.json(
            {
              error: `Stornierung nur bis ${rules.cancellation_hours_before}h vor der Session möglich`,
            },
            { status: 409 }
          );
        }
      }
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', bookingId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Last-Minute-Alert: Push an alle aktiven Mitglieder des Clubs
    // (außer dem Stornierenden), dass der Slot frei ist.
    // Non-fatal: Fehler werden geloggt, schlagen die Stornierung nicht fehl.
    // Ticket 2.5.1 — Sprint 4 Q2.
    try {
      await LastMinuteAlertService.sendAlertForCancellation({
        clubId: booking.club_id,
        courtId: booking.court_id,
        sessionStartTime: booking.session_start_time,
        cancelledByUserId: auth.user.id,
      });
    } catch (alertErr) {
      log.error(
        'Last-Minute-Alert fehlgeschlagen',
        alertErr instanceof Error ? alertErr : undefined
      );
    }

    // Der Trainer erfuhr von einer Abmeldung bisher nur, wenn er zufällig in die
    // Teilnehmerliste sah — im Verein landet genau das sonst per WhatsApp bei ihm.
    // Non-fatal: eine fehlgeschlagene Benachrichtigung darf die Abmeldung nicht
    // rückgängig machen.
    if (booking.session_id) {
      try {
        const svc = createServiceClient() as any;
        const { data: session } = await svc
          .from('sessions')
          .select('trainer_id, timeslot_start')
          .eq('id', booking.session_id)
          .maybeSingle();

        if (session?.trainer_id) {
          const [{ data: trainer }, { data: member }] = await Promise.all([
            svc.from('trainers').select('user_id').eq('id', session.trainer_id).maybeSingle(),
            svc.from('users').select('full_name').eq('id', booking.member_id).maybeSingle(),
          ]);

          if (trainer?.user_id) {
            // timeslot_start ist eine naive timestamp-Spalte, die den UTC-Zeitpunkt
            // hält — ohne das angehängte Z läse new Date() sie als Ortszeit.
            const termin = session.timeslot_start
              ? new Date(`${session.timeslot_start}Z`).toLocaleString('de-DE', {
                  timeZone: 'Europe/Berlin',
                  dateStyle: 'short',
                  timeStyle: 'short',
                })
              : 'einem Training';
            await svc.from('notifications').insert({
              user_id: trainer.user_id,
              club_id: booking.club_id,
              type: 'booking_cancelled',
              title: 'Abmeldung vom Training',
              message: `${member?.full_name ?? 'Ein Mitglied'} hat sich für ${termin} abgemeldet.`,
              read: false,
            });
          }
        }
      } catch (notifyErr) {
        log.error(
          'Trainer-Benachrichtigung zur Abmeldung fehlgeschlagen',
          notifyErr instanceof Error ? notifyErr : undefined
        );
      }
    }

    // Warteliste: Ersten Eintrag nachrücken lassen (non-fatal)
    // Note: session_waitlist not yet in generated types — using (svc as any)
    if (booking.session_id) {
      try {
        const serviceClient = createServiceClient();
        const svc = serviceClient as any;

        // Ersten Wartelisten-Eintrag holen
        const { data: nextInLine } = await svc
          .from('session_waitlist')
          .select('id, member_id, club_id, position')
          .eq('session_id', booking.session_id)
          .order('position', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (nextInLine) {
          const next = nextInLine as {
            id: string;
            member_id: string;
            club_id: string;
            position: number;
          };

          // Neue Buchung für nachrückendes Mitglied anlegen
          const { error: bookingError } = await serviceClient.from('bookings').insert({
            club_id: next.club_id,
            member_id: next.member_id,
            schedule_id: booking.schedule_id,
            session_id: booking.session_id,
            court_id: booking.court_id,
            status: 'confirmed',
            session_start_time: booking.session_start_time,
            booked_at: new Date().toISOString(),
          });

          if (!bookingError) {
            // Wartelisten-Eintrag entfernen
            await svc.from('session_waitlist').delete().eq('id', next.id);

            // Positionen der verbleibenden Einträge aktualisieren
            const { data: remaining } = await svc
              .from('session_waitlist')
              .select('id, position')
              .eq('session_id', booking.session_id)
              .order('position', { ascending: true });

            for (const r of (remaining ?? []) as Array<{ id: string; position: number }>) {
              await svc
                .from('session_waitlist')
                .update({ position: r.position - 1 })
                .eq('id', r.id);
            }

            // Benachrichtigung an nachgerücktes Mitglied senden
            const sessionDate = booking.session_start_time
              ? new Date(booking.session_start_time).toLocaleDateString('de-DE', {
                  weekday: 'long',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })
              : 'demnächst';

            await serviceClient.from('notifications').insert({
              user_id: next.member_id,
              club_id: next.club_id,
              type: 'waitlist_promoted',
              title: 'Platz frei!',
              message: `Du bist von der Warteliste nachgerückt für das Training am ${sessionDate}. Dein Platz ist jetzt bestätigt.`,
              read: false,
            });

            log.info('Warteliste: Mitglied nachgerückt', {
              sessionId: booking.session_id,
              promotedMemberId: next.member_id,
            });
          } else {
            log.error(
              'Warteliste: Buchung für nachgerücktes Mitglied fehlgeschlagen',
              bookingError instanceof Error ? bookingError : undefined
            );
          }
        }
      } catch (waitlistErr) {
        // Non-fatal: Stornierung war erfolgreich, Wartelisten-Promotion optional
        log.error(
          'Warteliste: Nachrücken fehlgeschlagen',
          waitlistErr instanceof Error ? waitlistErr : undefined
        );
      }
    }

    return NextResponse.json({ success: true, bookingId });
  });
}

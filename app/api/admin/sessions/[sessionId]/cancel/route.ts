import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import { Resend } from 'resend';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

const log = createLogger('api:admin:sessions:cancel');

// POST /api/admin/sessions/[sessionId]/cancel
// Body: { reason: string }
// Setzt cancelled_at auf der Session und benachrichtigt alle gebuchten Mitglieder.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  return withApiAuth(req, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    const isTrainer = await verifyRole(auth, 'trainer');
    if (!isAdmin && !isTrainer) {
      return forbiddenResponse('Admin oder Trainer-Zugang erforderlich');
    }

    const { sessionId } = await params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      return NextResponse.json({ error: 'Ungültige Session-ID' }, { status: 400 });
    }

    const body = await req.json();
    const reason: string = (body?.reason ?? '').trim();
    if (!reason) {
      return NextResponse.json({ error: 'Grund der Absage ist erforderlich' }, { status: 400 });
    }

    // Service-Client: bypasses RLS für Benachrichtigungen
    const supabase = createServiceClient();

    // Session laden mit club_id und Trainer-Info
    const { data: session, error: sessionErr } = await supabase
      .from('sessions')
      .select('id, trainer_id, club_id, timeslot_start, timeslot_end, cancelled_at')
      .eq('id', sessionId)
      .single();

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Session nicht gefunden' }, { status: 404 });
    }

    if (session.cancelled_at) {
      return NextResponse.json({ error: 'Session ist bereits abgesagt' }, { status: 409 });
    }

    // Trainer darf nur eigene Sessions absagen
    if (!isAdmin && session.trainer_id !== auth.user.id) {
      return forbiddenResponse('Trainer können nur eigene Sessions absagen');
    }

    // Admin muss zum gleichen Verein gehören
    if (isAdmin && auth.role !== 'superadmin' && session.club_id !== auth.clubId) {
      return forbiddenResponse('Keine Berechtigung für diese Session');
    }

    // Session absagen
    const { error: updateErr } = await supabase
      .from('sessions')
      .update({
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateErr) {
      log.error('Fehler beim Absagen der Session', updateErr);
      return NextResponse.json({ error: 'Absage fehlgeschlagen' }, { status: 500 });
    }

    // Alle bestätigten Buchungen für diese Session laden
    const { data: bookings, error: bookingsErr } = await supabase
      .from('bookings')
      .select('id, member_id, club_id')
      .eq('session_id', sessionId)
      .eq('status', 'confirmed');

    if (bookingsErr) {
      log.error('Fehler beim Laden der Buchungen', bookingsErr);
      // Absage bereits gesetzt — trotzdem 200 zurückgeben
      return NextResponse.json({ cancelled: true, notifiedCount: 0 });
    }

    const bookingList = bookings ?? [];
    if (bookingList.length === 0) {
      return NextResponse.json({ cancelled: true, notifiedCount: 0 });
    }

    // Datum/Zeit für Benachrichtigungstext
    const sessionDate = new Date(session.timeslot_start);
    const dateStr = sessionDate.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const timeStr = sessionDate.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const notificationMessage = `Dein Training am ${dateStr} um ${timeStr} Uhr wurde abgesagt. Grund: ${reason}`;

    // Notifications einfügen (einer pro Mitglied)
    const notificationInserts = bookingList.map((b) => ({
      user_id: b.member_id,
      club_id: b.club_id ?? session.club_id,
      type: 'session_cancelled',
      title: 'Training abgesagt',
      message: notificationMessage,
      read: false,
    }));

    const { error: notifErr } = await supabase.from('notifications').insert(notificationInserts);
    if (notifErr) {
      log.error('Fehler beim Einfügen der Benachrichtigungen', notifErr);
    }

    // E-Mails optional (non-blocking) via Resend
    let emailsSent = 0;
    try {
      const resendApiKey = env.RESEND_API_KEY;
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);

        // Member-E-Mails laden
        const memberIds = bookingList.map((b) => b.member_id);
        const { data: members } = await supabase
          .from('users')
          .select('id, email, full_name')
          .in('id', memberIds);

        for (const member of members ?? []) {
          if (!member.email) continue;
          try {
            await resend.emails.send({
              from: 'noreply@swingz.cloud',
              to: member.email,
              subject: 'Training abgesagt',
              html: `<p>Hallo ${member.full_name ?? 'Mitglied'},</p>
<p>${notificationMessage}</p>
<p>Bei Fragen wende dich bitte an deinen Trainer oder den Club.</p>
<p>Dein SwingZ-Team</p>`,
            });
            emailsSent++;
          } catch (emailErr) {
            log.error(
              'E-Mail-Versand fehlgeschlagen',
              emailErr instanceof Error ? emailErr : undefined
            );
          }
        }
      }
    } catch (err) {
      log.error('Fehler beim E-Mail-Versand', err instanceof Error ? err : undefined);
    }

    log.info('Session abgesagt', {
      sessionId,
      notifiedCount: bookingList.length,
      emailsSent,
    });

    return NextResponse.json({
      cancelled: true,
      notifiedCount: bookingList.length,
      emailsSent,
    });
  });
}

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { withApiAuth, verifyRole } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { env } from '@/lib/env';
import { createLogger } from '@/lib/logger';

const log = createLogger('quick-email');

/**
 * Sends a single, immediate email to one member/trainer of the admin's own
 * club — for the "quick email" action in the members/trainers list.
 *
 * Deliberately synchronous and separate from /api/email-campaigns: that
 * route only queues rows into email_campaigns/email_queue, which nothing
 * currently drains, so campaigns never actually send. This one recipient
 * doesn't need a queue — send it directly via Resend.
 */
export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
    }

    if (!auth.clubId) {
      return NextResponse.json({ error: 'Kein Club zugewiesen' }, { status: 400 });
    }

    const { userId, subject, body } = await request.json();

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Empfänger fehlt' }, { status: 400 });
    }
    if (!subject?.trim() || !body?.trim()) {
      return NextResponse.json({ error: 'Betreff und Nachricht erforderlich' }, { status: 400 });
    }

    const db = createServiceClient();

    // Only allow sending to a real, active member of the admin's own club —
    // never trust a client-supplied email address directly.
    const { data: membership, error: membershipError } = await db
      .from('user_club_memberships')
      .select('user_id, users!user_club_memberships_user_id_fkey(email, full_name)')
      .eq('user_id', userId)
      .eq('club_id', auth.clubId)
      .eq('is_active', true)
      .maybeSingle();

    if (membershipError) {
      log.error('Mitgliedschaft konnte nicht geladen werden', membershipError);
      return NextResponse.json({ error: 'Empfänger konnte nicht geladen werden' }, { status: 500 });
    }
    const recipient = Array.isArray(membership?.users) ? membership.users[0] : membership?.users;
    if (!membership || !recipient?.email) {
      return NextResponse.json({ error: 'Empfänger nicht gefunden' }, { status: 404 });
    }

    if (!env.RESEND_API_KEY) {
      log.error('RESEND_API_KEY nicht konfiguriert');
      return NextResponse.json({ error: 'E-Mail-Versand ist nicht konfiguriert' }, { status: 500 });
    }

    const resend = new Resend(env.RESEND_API_KEY);
    const from = env.EMAIL_FROM || 'SwingZ <noreply@swingz.cloud>';

    const { error: sendError } = await resend.emails.send({
      from,
      to: recipient.email,
      subject,
      text: body,
      html: body
        .split('\n')
        .map((line: string) => `<p>${line}</p>`)
        .join(''),
    });

    if (sendError) {
      log.error('Resend-Versand fehlgeschlagen', {
        recipient: recipient.email,
        message: sendError.message,
      });
      return NextResponse.json({ error: 'E-Mail konnte nicht gesendet werden' }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  });
}

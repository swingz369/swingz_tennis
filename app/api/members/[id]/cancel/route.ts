/**
 * POST /api/members/[id]/cancel
 *
 * Kündigt die Vereinsmitgliedschaft eines Mitglieds formell.
 * [id] = membership-ID (user_club_memberships.id)
 *
 * Hinweis: user_club_memberships hat kein cancellation_date-Feld im Schema.
 * Wir setzen is_active=false falls das Datum heute/Vergangenheit ist und
 * schreiben die Kündigung als audit_log-Eintrag (mit details.cancellation_date
 * und details.cancellation_reason).
 */
import { loadClubSender, escapeHtml } from '@/lib/email/club-sender';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { logAudit } from '@/lib/audit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:members:cancel');

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) return forbiddenResponse('Admin erforderlich');

    const { id: membershipId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const {
      reason,
      cancellation_date,
      send_confirmation,
    }: { reason?: string; cancellation_date?: string; send_confirmation?: boolean } = body;

    if (!cancellation_date) {
      return NextResponse.json({ error: 'Kündigungsdatum erforderlich' }, { status: 400 });
    }

    const serviceSb = createServiceClient();

    // Resolve membership → user
    const { data: membership } = await serviceSb
      .from('user_club_memberships')
      .select('user_id, club_id, is_active')
      .eq('id', membershipId)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Mitgliedschaft nicht gefunden' }, { status: 404 });
    }

    // Club-Isolation: Admin darf nur Mitglieder seines Vereins kündigen
    if (auth.role !== 'superadmin' && membership.club_id !== auth.clubId) {
      return forbiddenResponse('Kein Zugriff auf diesen Verein');
    }

    // Fetch user info for confirmation email
    const { data: user } = await serviceSb
      .from('users')
      .select('full_name, email')
      .eq('id', membership.user_id)
      .maybeSingle();

    // Deactivate immediately if cancellation_date is today or in the past
    const cancelDate = new Date(cancellation_date);
    const deactivateNow = cancelDate <= new Date();

    const { error } = await serviceSb
      .from('user_club_memberships')
      .update({ is_active: deactivateNow ? false : membership.is_active })
      .eq('id', membershipId);

    if (error) {
      log.error('Cancellation update failed', error);
      return NextResponse.json({ error: 'Kündigung fehlgeschlagen' }, { status: 500 });
    }

    // Persist cancellation details as audit log
    await logAudit({
      actorId: auth.user.id,
      action: 'membership_cancelled',
      resourceType: 'membership',
      resourceId: membershipId,
      clubId: membership.club_id,
      details: {
        user_id: membership.user_id,
        cancellation_date,
        cancellation_reason: reason ?? null,
        deactivated_immediately: deactivateNow,
      },
      request,
    });

    // Bestätigungs-E-Mail via Resend (fire-and-forget)
    if (send_confirmation && user?.email) {
      void (async () => {
        try {
          const resendKey = process.env.RESEND_API_KEY;
          if (!resendKey) return;
          const { Resend } = await import('resend');
          const resend = new Resend(resendKey);
          const dateStr = cancelDate.toLocaleDateString('de-DE');
          const sender = await loadClubSender(
            auth.supabase,
            membership.club_id ?? auth.clubId ?? ''
          );
          await resend.emails.send({
            from: sender.from,
            replyTo: sender.replyTo,
            to: user.email,
            subject: 'Kündigungsbestätigung – Vereinsmitgliedschaft',
            html: [
              `<p>Hallo ${escapeHtml(user.full_name ?? '')},</p>`,
              `<p>wir bestätigen den Eingang deiner Kündigung. Deine Mitgliedschaft endet zum <strong>${dateStr}</strong>.</p>`,
              reason ? `<p>Grund: ${escapeHtml(reason)}</p>` : '',
              `<p>Wir bedauern deinen Austritt und wünschen dir alles Gute.</p>`,
              `<p>${escapeHtml(sender.name)}</p>`,
            ].join(''),
          });
        } catch (mailErr) {
          log.error(
            'Bestätigungs-E-Mail fehlgeschlagen',
            mailErr instanceof Error ? mailErr : undefined
          );
        }
      })();
    }

    log.info('Membership cancelled', { membershipId, cancellation_date, deactivateNow });
    return NextResponse.json({ success: true, deactivated_immediately: deactivateNow });
  });
}

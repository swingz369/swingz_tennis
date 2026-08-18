import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { Resend } from 'resend';
import { withApiAuth, verifyRole } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { env } from '@/lib/env';
import { createLogger } from '@/lib/logger';

const log = createLogger('email-campaigns');

/**
 * Uses the service client throughout: the RLS policy that lets admins
 * read other members' `users` rows depends on a users.role column that
 * no longer exists (see work-duties fix), so it silently blocks this join.
 *
 * Sends synchronously in this same request instead of only queuing —
 * nothing ever drained email_queue previously (no cron/edge function
 * read it), so campaigns were silently never delivered. The campaign UI
 * doesn't expose a "send later" date picker, so there's no real need for
 * a queue/worker split; a parallel send here is simpler and immediate.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Pro plan — enough for a few hundred recipients sent in parallel

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }

    const db = createServiceClient();
    const user = auth.user;

    if (!auth.clubId) {
      return NextResponse.json({ error: 'Kein Club zugewiesen' }, { status: 400 });
    }

    const { subject, body, targetGroup, memberIds } = await request.json();

    if (!subject || !body) {
      return NextResponse.json({ error: 'Betreff und Inhalt erforderlich' }, { status: 400 });
    }

    let query = db
      .from('user_club_memberships')
      .select('user_id, role, users!user_club_memberships_user_id_fkey(email, full_name)')
      .eq('club_id', auth.clubId)
      .eq('is_active', true);

    if (Array.isArray(memberIds) && memberIds.length > 0) {
      query = query.in('user_id', memberIds);
    } else if (targetGroup === 'members') {
      query = query.eq('role', 'member');
    } else if (targetGroup === 'trainers') {
      query = query.eq('role', 'trainer');
    } else {
      query = query.not('role', 'eq', 'superadmin');
    }

    const { data: recipients, error: fetchError } = await query;

    if (fetchError) {
      return internalErrorResponse();
    }
    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'Keine Empfänger gefunden' }, { status: 400 });
    }

    const emailEntries = recipients
      .map((r: any) => {
        const u = Array.isArray(r.users) ? r.users[0] : r.users;
        return { email: u?.email as string | undefined, name: u?.full_name || 'Mitglied' };
      })
      .filter((e: { email?: string }) => !!e.email);

    if (emailEntries.length === 0) {
      return NextResponse.json({ error: 'Keine Empfänger gefunden' }, { status: 400 });
    }

    // Create campaign record
    const { data: campaign, error: campaignError } = await db
      .from('email_campaigns')
      .insert({
        club_id: auth.clubId,
        subject,
        body,
        target_group: memberIds?.length ? 'custom' : targetGroup || 'all',
        recipient_count: emailEntries.length,
        status: 'sending',
        created_by: user.id,
      })
      .select('id')
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Kampagne konnte nicht erstellt werden' }, { status: 500 });
    }

    // Create individual email queue entries up front, so a crashed send
    // still leaves a record of who was supposed to receive what.
    const { data: queueRows, error: queueError } = await db
      .from('email_queue')
      .insert(
        emailEntries.map((e: { email: string | undefined; name: string }) => ({
          club_id: auth.clubId,
          campaign_id: campaign.id,
          recipient_email: e.email!,
          recipient_name: e.name,
          subject,
          body,
          status: 'pending',
        }))
      )
      .select('id, recipient_email');

    if (queueError || !queueRows) {
      return NextResponse.json(
        { error: 'Warteschlange konnte nicht angelegt werden' },
        { status: 500 }
      );
    }

    if (!env.RESEND_API_KEY) {
      log.error('RESEND_API_KEY nicht konfiguriert — Kampagne bleibt in der Warteschlange');
      return NextResponse.json({ error: 'E-Mail-Versand ist nicht konfiguriert' }, { status: 500 });
    }

    const resend = new Resend(env.RESEND_API_KEY);
    const from = env.EMAIL_FROM || 'SwingZ <noreply@swingz.cloud>';
    const html = body
      .split('\n')
      .map((line: string) => `<p>${line}</p>`)
      .join('');

    const results = await Promise.allSettled(
      queueRows.map((row: { id: string; recipient_email: string }) =>
        resend.emails.send({ from, to: row.recipient_email, subject, text: body, html })
      )
    );

    let sentCount = 0;
    let failedCount = 0;

    await Promise.all(
      results.map(async (result, i) => {
        const row = queueRows[i];
        const failed = result.status === 'rejected' || !!(result.value as any)?.error;
        if (failed) {
          failedCount++;
          const errorMessage =
            result.status === 'rejected'
              ? String(result.reason)
              : (result.value as any).error?.message;
          await db
            .from('email_queue')
            .update({ status: 'failed', error_message: errorMessage })
            .eq('id', row.id);
        } else {
          sentCount++;
          await db
            .from('email_queue')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', row.id);
        }
      })
    );

    await db
      .from('email_campaigns')
      .update({ status: failedCount === 0 ? 'sent' : sentCount === 0 ? 'failed' : 'sent' })
      .eq('id', campaign.id);

    if (failedCount > 0) {
      log.error('Kampagne teilweise fehlgeschlagen', {
        campaignId: campaign.id,
        sentCount,
        failedCount,
      });
    }

    if (sentCount === 0) {
      return NextResponse.json(
        {
          error: `E-Mail-Versand fehlgeschlagen (0 von ${emailEntries.length} Empfängern erreicht)`,
          recipientCount: emailEntries.length,
          sentCount,
          failedCount,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      recipientCount: emailEntries.length,
      sentCount,
      failedCount,
      message:
        failedCount === 0
          ? `E-Mail an ${sentCount} Empfänger gesendet`
          : `${sentCount} von ${emailEntries.length} E-Mails gesendet, ${failedCount} fehlgeschlagen`,
    });
  });
}

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }

    if (!auth.clubId) {
      return NextResponse.json({ error: 'Kein Club zugewiesen' }, { status: 400 });
    }
    const db = createServiceClient();

    const { data, error } = await db
      .from('email_campaigns')
      .select('*')
      .eq('club_id', auth.clubId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return internalErrorResponse();
    }

    return NextResponse.json({ campaigns: data });
  });
}

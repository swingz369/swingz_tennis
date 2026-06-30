/**
 * POST /api/admin/newsletters — Newsletter-Kampagne erstellen und versenden
 * GET  /api/admin/newsletters — Letzte Kampagnen auflisten
 *
 * 2.5.3 Newsletter-Wizard
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { env } from '@/lib/env';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:admin:newsletters');

const SendSchema = z.object({
  template: z.enum(['news', 'event', 'reminder']),
  subject: z.string().min(3).max(200),
  body_html: z.string().min(10).max(50_000),
});

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    if (!isAdmin) return forbiddenResponse('Admin-Zugriff erforderlich');

    const body = await req.json();
    const parsed = SendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 });
    }

    const { template, subject, body_html } = parsed.data;
    const clubId = auth.clubId;
    const sb = createServiceClient();

    // Fetch active member emails for this club
    const { data: memberships } = await sb
      .from('user_club_memberships')
      .select('user_id')
      .eq('club_id', clubId)
      .eq('is_active', true)
      .in('role', ['member', 'trainer', 'admin']);

    const userIds = (memberships ?? []).map((m) => m.user_id);
    if (userIds.length === 0) {
      return NextResponse.json({ error: 'Keine aktiven Mitglieder gefunden' }, { status: 400 });
    }

    const { data: users } = await sb
      .from('users')
      .select('email')
      .in('id', userIds)
      .not('email', 'is', null);

    const emails = (users ?? []).map((u) => u.email).filter(Boolean) as string[];
    if (emails.length === 0) {
      return NextResponse.json({ error: 'Keine E-Mail-Adressen gefunden' }, { status: 400 });
    }

    // Create campaign record
    const { data: campaign, error: campErr } = await (sb as any)
      .from('newsletter_campaigns')
      .insert({
        club_id: clubId,
        actor_id: auth.user.id,
        template,
        subject,
        body_html,
        recipient_count: emails.length,
      })
      .select('id')
      .single();

    if (campErr || !campaign) {
      log.error('Failed to create newsletter campaign', campErr);
      return NextResponse.json({ error: 'Kampagne konnte nicht erstellt werden' }, { status: 500 });
    }

    // Send via Resend (sequential — respects rate limit, logs each result)
    const resend = new Resend(env.RESEND_API_KEY);
    let sent = 0;
    let failed = 0;
    const sendLogs: Array<{
      campaign_id: string;
      recipient_email: string;
      status: string;
      error_message?: string;
    }> = [];

    for (const email of emails) {
      try {
        await resend.emails.send({
          from: 'noreply@swingz.cloud',
          to: email,
          subject,
          html: body_html,
        });
        sendLogs.push({ campaign_id: campaign.id, recipient_email: email, status: 'sent' });
        sent++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        log.error('Newsletter send failed', { email, error: msg });
        sendLogs.push({
          campaign_id: campaign.id,
          recipient_email: email,
          status: 'failed',
          error_message: msg,
        });
        failed++;
      }
    }

    // Batch-insert send logs + mark campaign as sent
    await Promise.all([
      (sb as any).from('newsletter_send_logs').insert(sendLogs),
      (sb as any)
        .from('newsletter_campaigns')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', campaign.id),
    ]);

    return NextResponse.json({ campaignId: campaign.id, sent, failed }, { status: 201 });
  });
}

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    if (!isAdmin) return forbiddenResponse('Admin-Zugriff erforderlich');

    const sb = createServiceClient();
    const { data, error } = await (sb as any)
      .from('newsletter_campaigns')
      .select('id, template, subject, recipient_count, sent_at, created_at')
      .eq('club_id', auth.clubId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 });
    }

    return NextResponse.json({ campaigns: data ?? [] });
  });
}

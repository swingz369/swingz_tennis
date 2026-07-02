import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Note: 'email_campaigns' and 'email_queue' are not in the generated
 * Database type, so (db as any) is used for those specific calls.
 * Uses the service client throughout: the RLS policy that lets admins
 * read other members' `users` rows depends on a users.role column that
 * no longer exists (see work-duties fix), so it silently blocks this join.
 */

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = createServiceClient() as any;
    const user = auth.user;

    if (!auth.clubId) {
      return NextResponse.json({ error: 'Kein Club zugewiesen' }, { status: 400 });
    }

    const { subject, body, targetGroup, memberIds, scheduleDate } = await request.json();

    if (!subject || !body) {
      return NextResponse.json({ error: 'Betreff und Inhalt erforderlich' }, { status: 400 });
    }

    let query = db
      .from('user_club_memberships')
      .select('user_id, role, users(email, full_name)')
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
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'Keine Empfänger gefunden' }, { status: 400 });
    }

    // Create campaign record
    const { error: campaignError } = await db.from('email_campaigns').insert({
      club_id: auth.clubId,
      subject,
      body,
      target_group: memberIds?.length ? 'custom' : targetGroup || 'all',
      recipient_count: recipients.length,
      status: 'queued',
      scheduled_at: scheduleDate || new Date().toISOString(),
      created_by: user.id,
    });

    if (campaignError) {
      return NextResponse.json({ error: campaignError.message }, { status: 500 });
    }

    // Create individual email queue entries
    const emailEntries = recipients
      .map((r: any) => {
        const u = Array.isArray(r.users) ? r.users[0] : r.users;
        return {
          club_id: auth.clubId,
          recipient_email: u?.email,
          recipient_name: u?.full_name || 'Mitglied',
          subject,
          body,
          status: 'pending',
        };
      })
      .filter((e: { recipient_email?: string }) => !!e.recipient_email);

    const { error: queueError } = await db.from('email_queue').insert(emailEntries);
    if (queueError) {
      return NextResponse.json({ error: queueError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      recipientCount: emailEntries.length,
      message: `Kampagne an ${emailEntries.length} Empfänger in die Warteschlange gestellt`,
    });
  });
}

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = createServiceClient() as any;

    const { data, error } = await db
      .from('email_campaigns')
      .select('*')
      .eq('club_id', auth.clubId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ campaigns: data });
  });
}

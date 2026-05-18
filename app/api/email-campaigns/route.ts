import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole } from '@/lib/api-auth';

/**
 * Note: 'email_campaigns', 'email_queue', and 'groups' are not in the
 * generated Database type. (supabase as any) is used only for those
 * untyped tables. auth.supabase is the user-scoped anon-key client so
 * RLS is still enforced.
 */

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sb = auth.supabase as any;
    const user = auth.user;

    if (!auth.clubId) {
      return NextResponse.json({ error: 'Kein Club zugewiesen' }, { status: 400 });
    }

    const { subject, body, targetGroup, scheduleDate } = await request.json();

    if (!subject || !body) {
      return NextResponse.json({ error: 'Betreff und Inhalt erforderlich' }, { status: 400 });
    }

    // Fetch target members
    let query = auth.supabase
      .from('user_club_memberships')
      .select('user_id, users(email, full_name)')
      .eq('club_id', auth.clubId)
      .eq('is_active', true);

    if (targetGroup && targetGroup !== 'all') {
      const { data: groupMembers } = await sb
        .from('groups')
        .select('member_id')
        .eq('name', targetGroup)
        .eq('club_id', auth.clubId);

      if (groupMembers) {
        const userIds = (groupMembers as any[]).map((g: any) => g.member_id);
        query = query.in('user_id', userIds);
      }
    }

    const { data: recipients, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'Keine Empfänger gefunden' }, { status: 400 });
    }

    // Create campaign record
    const { error: campaignError } = await sb.from('email_campaigns').insert({
      club_id: auth.clubId,
      subject,
      body,
      target_group: targetGroup || 'all',
      recipient_count: recipients.length,
      status: 'queued',
      scheduled_at: scheduleDate || new Date().toISOString(),
      created_by: user.id,
    });

    if (campaignError) {
      return NextResponse.json({ error: campaignError.message }, { status: 500 });
    }

    // Create individual email queue entries
    const emailEntries = recipients.map((r: any) => ({
      club_id: auth.clubId,
      recipient_email: r.users?.email || r.email,
      recipient_name: r.users?.full_name || r.full_name || 'Mitglied',
      subject,
      body,
      status: 'pending',
    }));

    const { error: queueError } = await sb.from('email_queue').insert(emailEntries);
    if (queueError) {
      return NextResponse.json({ error: queueError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      recipientCount: recipients.length,
      message: `Kampagne an ${recipients.length} Empfänger in die Warteschlange gestellt`,
    });
  });
}

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sb = auth.supabase as any;

    const { data, error } = await sb
      .from('email_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ campaigns: data });
  });
}

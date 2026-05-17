import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify admin
    const { data: membership } = await supabase
      .from('user_club_memberships')
      .select('role, club_id')
      .eq('user_id', user.id)
      .in('role', ['admin', 'superadmin'])
      .maybeSingle();

    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (!membership.club_id) {
      return NextResponse.json({ error: 'Kein Club zugewiesen' }, { status: 400 });
    }

    const { subject, body, targetGroup, scheduleDate } = await request.json();

    if (!subject || !body) {
      return NextResponse.json({ error: 'Betreff und Inhalt erforderlich' }, { status: 400 });
    }

    // Fetch target members
    let query = supabase
      .from('user_club_memberships')
      .select('user_id, users(email, full_name)')
      .eq('club_id', membership.club_id)
      .eq('is_active', true);

    if (targetGroup && targetGroup !== 'all') {
      // Filter by group if specified
      const { data: groupMembers } = await (supabase as any)
        .from('groups')
        .select('member_id')
        .eq('name', targetGroup)
        .eq('club_id', membership.club_id);

      if (groupMembers) {
        const userIds = (groupMembers as any[]).map((g: any) => g.member_id);
        query = query.in('user_id', userIds);
      }
    }

    const { data: recipients, error: fetchError } = await query;

    if (fetchError) throw fetchError;
    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'Keine Empfänger gefunden' }, { status: 400 });
    }

    // Create campaign record
    const { error: campaignError } = await (supabase as any).from('email_campaigns').insert({
      club_id: membership.club_id,
      subject,
      body,
      target_group: targetGroup || 'all',
      recipient_count: recipients.length,
      status: 'queued',
      scheduled_at: scheduleDate || new Date().toISOString(),
      created_by: user.id,
    });

    if (campaignError) throw campaignError;

    // Create individual email queue entries
    const emailEntries = recipients.map((r: any) => ({
      club_id: membership.club_id,
      recipient_email: r.users?.email || r.email,
      recipient_name: r.users?.full_name || r.full_name || 'Mitglied',
      subject,
      body,
      status: 'pending',
    }));

    const { error: queueError } = await (supabase as any).from('email_queue').insert(emailEntries);
    if (queueError) throw queueError;

    return NextResponse.json({
      success: true,
      recipientCount: recipients.length,
      message: `Kampagne an ${recipients.length} Empfänger in die Warteschlange gestellt`,
    });
  } catch (error: any) {
    console.error('Email campaign error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await (supabase as any)
      .from('email_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({ campaigns: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

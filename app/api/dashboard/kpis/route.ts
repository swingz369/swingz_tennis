import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const clubId = url.searchParams.get('clubId');

    if (!clubId) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
    }

    // Active members count
    const { count: membersCount } = await supabase
      .from('user_club_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('is_active', true);

    // Total courts
    const { count: courtsCount } = await supabase
      .from('courts')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('is_active', true);

    // Sessions today
    const { data: schedules } = await supabase
      .from('schedules')
      .select('id')
      .eq('club_id', clubId)
      .eq('is_active', true);

    const scheduleIds = schedules?.map((s: { id: string }) => s.id) || [];
    let sessionsToday = 0;
    if (scheduleIds.length > 0) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setHours(23, 59, 59, 999);
      const { count: sessCount } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .in('schedule_id', scheduleIds)
        .gte('timeslot_start', todayStart.toISOString())
        .lte('timeslot_start', todayEnd.toISOString());
      sessionsToday = sessCount || 0;
    }

    // Pending bookings
    const { count: pendingCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('status', 'pending');

    return NextResponse.json({
      activeMembers: membersCount || 0,
      sessionsToday,
      pendingBookings: pendingCount || 0,
      totalCourts: courtsCount || 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching dashboard KPIs:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

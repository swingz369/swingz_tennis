import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'trainer');
    if (!hasRole) {
      return forbiddenResponse('Trainer access required');
    }

    const rateLimitError = await checkRateLimitOrFail(req, rateLimit);
    if (rateLimitError) return rateLimitError;

    try {
      const url = new URL(req.url);
      const clubId = url.searchParams.get('clubId');

      if (!clubId) {
        return NextResponse.json({ error: 'clubId required' }, { status: 400 });
      }

      const { count: membersCount } = await auth.supabase
        .from('user_club_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('is_active', true);

      const { count: courtsCount } = await auth.supabase
        .from('courts')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('is_active', true);

      const { data: schedules } = await auth.supabase
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
        const { count: sessCount } = await auth.supabase
          .from('sessions')
          .select('*', { count: 'exact', head: true })
          .in('schedule_id', scheduleIds)
          .gte('timeslot_start', todayStart.toISOString())
          .lte('timeslot_start', todayEnd.toISOString());
        sessionsToday = sessCount || 0;
      }

      const { count: pendingCount } = await auth.supabase
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
  });
}

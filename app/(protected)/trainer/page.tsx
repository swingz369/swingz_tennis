import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import TrainerDashboardClient from './trainer-dashboard-client';
import type { TrainerSession, TrainerStats } from './trainer-dashboard-client';

export const dynamic = 'force-dynamic';

export default async function TrainerPage() {
  const { supabase, user } = await requireAuth();

  // Get trainer record
  const { data: trainerRecord } = await supabase
    .from('trainers')
    .select('id, name')
    .ilike('email', user.email!)
    .eq('is_active', true)
    .maybeSingle();

  if (!trainerRecord) {
    redirect('/member');
  }

  // Fetch sessions with bookings.
  // Season planning may store either the trainers-table id or the user id in
  // sessions.trainer_id, so match against both to keep the plan visible.
  const { data: rawSessions } = await supabase
    .from('sessions')
    .select(
      `id, timeslot_start, timeslot_end, max_participants,
       courts(name), groups(name),
       bookings(id, status, member_id)`
    )
    .in('trainer_id', [trainerRecord.id, user.id])
    .order('timeslot_start', { ascending: true });

  // Collect all member_ids from bookings for name lookup
  const memberIds = new Set<string>();
  for (const s of rawSessions ?? []) {
    const bookings = (s as Record<string, unknown>).bookings as Array<{
      member_id: string | null;
    }> | null;
    for (const b of bookings ?? []) {
      if (b.member_id) memberIds.add(b.member_id);
    }
  }

  // Batch-fetch member names
  let memberNames: Record<string, string> = {};
  if (memberIds.size > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', [...memberIds]);

    memberNames = Object.fromEntries(
      (users ?? []).map((u) => [u.id, u.full_name || u.email || 'Unbekannt'])
    );
  }

  // Transform sessions
  const sessions: TrainerSession[] = (rawSessions ?? []).map((s) => {
    const record = s as Record<string, unknown>;
    const court = record.courts as { name: string } | { name: string }[] | null;
    const group = record.groups as { name: string } | { name: string }[] | null;
    const bookings = record.bookings as Array<{
      id: string;
      status: string;
      member_id: string | null;
    }> | null;

    const courtName = Array.isArray(court) ? court[0]?.name : court?.name;
    const groupName = Array.isArray(group) ? group[0]?.name : group?.name;

    return {
      id: record.id as string,
      startTime: record.timeslot_start as string,
      endTime: record.timeslot_end as string,
      maxParticipants: record.max_participants as number | undefined,
      courtName: courtName ?? undefined,
      groupName: groupName ?? undefined,
      attendees: (bookings ?? []).map((b) => ({
        bookingId: b.id,
        memberName: memberNames[b.member_id ?? ''] ?? 'Unbekannt',
        status: b.status,
      })),
    };
  });

  // Calculate stats
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const upcomingSessions = sessions.filter((s) => new Date(s.startTime) >= now).length;
  const thisWeekSessions = sessions.filter((s) => new Date(s.startTime) >= weekAgo).length;

  const totalAttendees = sessions.reduce((sum, s) => sum + (s.attendees?.length ?? 0), 0);
  const noShowCount = sessions.reduce(
    (sum, s) => sum + (s.attendees?.filter((a) => a.status === 'no_show').length ?? 0),
    0
  );
  const attendanceRate =
    totalAttendees > 0 ? Math.round(((totalAttendees - noShowCount) / totalAttendees) * 100) : 0;

  const stats: TrainerStats = {
    totalSessions: sessions.length,
    upcomingSessions,
    thisWeekSessions,
    attendanceRate,
  };

  return <TrainerDashboardClient sessions={sessions} stats={stats} />;
}

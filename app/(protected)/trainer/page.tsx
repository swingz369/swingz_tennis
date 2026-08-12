import { requireAuth } from '@/lib/auth';
import { asUtcIso } from '@/lib/format';
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
      // `groups(name)` stand hier bis zum 12.08.2026 als Einbettung. Zwischen
      // `sessions` und `groups` gibt es aber keinen Fremdschlüssel — die Gruppen
      // hängen als jsonb-Array in `group_ids`. PostgREST beantwortete die Abfrage
      // deshalb mit PGRST200, `data` blieb null, und da der Fehler nicht geprüft
      // wurde, zeigte das Trainer-Dashboard kommentarlos "0 Sessions" — obwohl
      // die Trainerin 20 veröffentlichte Einheiten hatte.
      `id, timeslot_start, timeslot_end, max_participants, group_ids,
       courts(name),
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

  // Gruppennamen über group_ids nachladen (siehe Kommentar an der Abfrage oben)
  const groupIds = new Set<string>();
  for (const s of rawSessions ?? []) {
    for (const gid of ((s as Record<string, unknown>).group_ids as string[] | null) ?? []) {
      if (gid) groupIds.add(gid);
    }
  }
  let groupNames: Record<string, string> = {};
  if (groupIds.size > 0) {
    const { data: groupRows } = await supabase
      .from('groups')
      .select('id, name')
      .in('id', [...groupIds]);
    groupNames = Object.fromEntries((groupRows ?? []).map((g) => [g.id, g.name]));
  }

  // Transform sessions
  const sessions: TrainerSession[] = (rawSessions ?? []).map((s) => {
    const record = s as Record<string, unknown>;
    const court = record.courts as { name: string } | { name: string }[] | null;
    const firstGroupId = ((record.group_ids as string[] | null) ?? [])[0];
    const bookings = record.bookings as Array<{
      id: string;
      status: string;
      member_id: string | null;
    }> | null;

    const courtName = Array.isArray(court) ? court[0]?.name : court?.name;
    const groupName = firstGroupId ? groupNames[firstGroupId] : undefined;

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

  // Die Kachel heißt "Diese Woche" und zählte bislang alles ab einer Woche in der
  // Vergangenheit — also faktisch die ganze Saison. Eine Trainerin mit 20 Terminen
  // von Oktober bis März las dort "20 Einheiten diese Woche".
  const weekStart = new Date(now);
  const weekday = (weekStart.getDay() + 6) % 7; // Montag = 0
  weekStart.setDate(weekStart.getDate() - weekday);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // timeslot_start trägt keine Zeitzone — als UTC lesen, sonst verschiebt sich
  // die Wochengrenze um den Zonenversatz.
  const startOf = (s: TrainerSession) => new Date(asUtcIso(s.startTime) as string);

  const upcomingSessions = sessions.filter((s) => startOf(s) >= now).length;
  const thisWeekSessions = sessions.filter(
    (s) => startOf(s) >= weekStart && startOf(s) < weekEnd
  ).length;

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

  // trainerId/-Name werden durchgereicht: ohne sie schrieb der Check-in
  // Anwesenheitseinträge mit trainerId 'unknown'.
  return (
    <TrainerDashboardClient
      sessions={sessions}
      stats={stats}
      trainerId={trainerRecord.id}
      trainerName={trainerRecord.name}
    />
  );
}

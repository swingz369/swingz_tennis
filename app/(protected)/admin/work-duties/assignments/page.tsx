import { requireAdminClub } from '@/lib/admin-context';
import AssignmentsClient from './assignments-client';

export const metadata = {
  title: 'Zuweisungen — SwingZ',
};

export default async function AssignmentsPage() {
  const { supabase, clubId } = await requireAdminClub();

  // Fetch all duties with assignments for this club
  const { data: duties } = await supabase
    .from('work_duties')
    .select(
      'id, title, duty_type, scheduled_date, start_time, end_time, status, priority, work_duty_assignments(id, member_id, status, completed_at)'
    )
    .eq('club_id', clubId)
    .order('scheduled_date', { ascending: true, nullsFirst: false });

  // Collect all unique member IDs from assignments
  const memberIds = new Set<string>();
  for (const duty of duties ?? []) {
    for (const a of (duty as any).work_duty_assignments ?? []) {
      if (a.member_id) memberIds.add(a.member_id);
    }
  }

  // Fetch member names
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

  // Enrich duties with member names
  const enrichedDuties = (duties ?? []).map((duty) => ({
    ...(duty as any),
    work_duty_assignments: ((duty as any).work_duty_assignments ?? []).map((a: any) => ({
      ...a,
      name: memberNames[a.member_id] ?? 'Unbekannt',
    })),
  }));

  // Calculate stats per member
  const memberStats: Record<string, { name: string; assigned: number; completed: number }> = {};
  for (const duty of enrichedDuties) {
    for (const a of duty.work_duty_assignments) {
      if (!memberStats[a.member_id]) {
        memberStats[a.member_id] = { name: a.name, assigned: 0, completed: 0 };
      }
      memberStats[a.member_id].assigned++;
      if (a.status === 'completed') {
        memberStats[a.member_id].completed++;
      }
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">Zuweisungen</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Übersicht aller Arbeitsdienst-Zuweisungen und deren Status
        </p>
      </div>
      <AssignmentsClient duties={enrichedDuties} memberStats={memberStats} />
    </div>
  );
}

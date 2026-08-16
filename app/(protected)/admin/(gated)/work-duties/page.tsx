import { requireAdminClub } from '@/lib/admin-context';
import { createServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/ui/page-header';
import {
  WorkDutiesHubTabs,
  type DutyWithAssignments,
  type MemberStat,
} from './work-duties-hub-tabs';

export const metadata = {
  title: 'Arbeitsdienst — SwingZ',
};

export default async function WorkDutiesPage() {
  const { supabase, clubId } = await requireAdminClub();

  // Service client: RLS's "admin can read all users" policy relies on a
  // users.role column that no longer exists, so it silently blocks this join.
  // requireAdminClub() has already authorized the caller as admin/superadmin.
  const serviceSupabase = createServiceClient();
  const { data: clubMemberships } = await serviceSupabase
    .from('user_club_memberships')
    .select('user_id, role, users!user_club_memberships_user_id_fkey(id, full_name, email)')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .not('role', 'eq', 'superadmin');

  const members = (clubMemberships ?? [])
    .map((m: Record<string, unknown>) => {
      const user = m.users as Record<string, unknown> | null;
      if (!user) return null;
      return {
        id: String(user.id),
        name: String(user.full_name || 'N/A'),
        email: String(user.email || ''),
      };
    })
    .filter((m): m is { id: string; name: string; email: string } => m !== null);

  // Dienste mit ihren Zuweisungen — zweite Sicht (Tab „Zuweisungen").
  const { data: duties } = await supabase
    .from('work_duties')
    .select(
      'id, title, duty_type, scheduled_date, start_time, end_time, status, priority, work_duty_assignments(id, member_id, status, completed_at)'
    )
    .eq('club_id', clubId)
    .order('scheduled_date', { ascending: true, nullsFirst: false });

  // Member-Namen für die Zuweisungs-Sicht auflösen.
  const memberIds = new Set<string>();
  for (const duty of duties ?? []) {
    for (const a of (duty as { work_duty_assignments?: { member_id: string }[] })
      .work_duty_assignments ?? []) {
      if (a.member_id) memberIds.add(a.member_id);
    }
  }

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

  const enrichedDuties: DutyWithAssignments[] = (duties ?? []).map(
    (duty) =>
      ({
        ...(duty as Record<string, unknown>),
        work_duty_assignments: (
          (duty as { work_duty_assignments?: { member_id: string }[] }).work_duty_assignments ?? []
        ).map((a) => ({
          ...a,
          name: memberNames[a.member_id] ?? 'Unbekannt',
        })),
      }) as DutyWithAssignments
  );

  // Kennzahlen pro Mitglied: zugewiesen vs. erledigt.
  const memberStats: Record<string, MemberStat> = {};
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
    <div className="space-y-6">
      <PageHeader
        title="Arbeitsdienst"
        description="Gemeinschaftsdienste verwalten und Mitglieder zuweisen"
      />
      <WorkDutiesHubTabs members={members} duties={enrichedDuties} memberStats={memberStats} />
    </div>
  );
}

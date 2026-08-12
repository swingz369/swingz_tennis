import { requireAdminClub } from '@/lib/admin-context';
import { createServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/ui/page-header';
import WorkDutiesClient from './work-duties-client';

export const metadata = {
  title: 'Arbeitsdienst — SwingZ',
};

export default async function WorkDutiesPage() {
  const { clubId } = await requireAdminClub();

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

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Arbeitsdienst"
        description="Gemeinschaftsdienste verwalten und Mitglieder zuweisen"
        breadcrumbs={[{ label: 'Arbeitsdienst' }]}
      />
      <WorkDutiesClient members={members} />
    </div>
  );
}

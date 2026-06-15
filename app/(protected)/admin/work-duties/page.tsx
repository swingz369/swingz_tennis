import { requireAdminClub } from '@/lib/admin-context';
import WorkDutiesClient from './work-duties-client';

export const metadata = {
  title: 'Arbeitsdienst — SwingZ',
};

export default async function WorkDutiesPage() {
  const { supabase, clubId } = await requireAdminClub();

  // Fetch members for assignment
  const { data: clubMemberships } = await supabase
    .from('user_club_memberships')
    .select('user_id, role, users(id, full_name, email)')
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
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">Arbeitsdienst</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gemeinschaftsdienste verwalten und Mitglieder zuweisen
        </p>
      </div>
      <WorkDutiesClient members={members} />
    </div>
  );
}

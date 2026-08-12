import { requireAdminClub } from '@/lib/admin-context';
import LeagueDetailClient from './league-detail-client';

export const dynamic = 'force-dynamic';

export default async function LeagueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, clubId } = await requireAdminClub();

  // Fetch members for team assignment
  const { data: clubMemberships } = await supabase
    .from('user_club_memberships')
    .select('user_id, role, users!user_club_memberships_user_id_fkey(id, full_name, email)')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .in('role', ['member', 'trainer']);

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
      <LeagueDetailClient leagueId={id} members={members} />
    </div>
  );
}

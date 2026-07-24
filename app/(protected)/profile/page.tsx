import { requireAuth } from '@/lib/auth';
import MemberProfile from '@/components/member-profile';
import { SeasonStatsCard } from '@/components/member-profile/season-stats-card';
import HeadToHead from '@/components/matches/head-to-head';

export default async function MemberProfilePage() {
  // Ensure user is authenticated before rendering the profile page
  const { supabase, user } = await requireAuth();

  // Aktive Mitgliedschaft für Saison-Stats & Head-to-Head (aus /member/profile konsolidiert)
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('club_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1);
  const clubId = memberships?.[0]?.club_id as string | undefined;

  return (
    <div className="space-y-6">
      <MemberProfile />
      {clubId && (
        <>
          <SeasonStatsCard userId={user.id} clubId={clubId} />
          <HeadToHead myUserId={user.id} clubId={clubId} />
        </>
      )}
    </div>
  );
}

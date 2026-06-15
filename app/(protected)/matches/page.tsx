import OpenMatches from '@/components/open-matches';
import { createClient } from '@/lib/supabase/server';

export default async function MatchesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Get club ID from membership
  const { data: membership } = await supabase
    .from('user_club_memberships')
    .select('club_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  const clubId = membership?.club_id;
  if (!clubId) {
    return <div className="p-6 text-center text-muted-foreground">Kein Verein gefunden.</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <OpenMatches clubId={clubId} userId={user.id} />
    </div>
  );
}

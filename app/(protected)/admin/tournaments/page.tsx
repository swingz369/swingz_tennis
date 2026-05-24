import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { cookies } from 'next/headers';
import { ADMIN_CLUB_COOKIE } from '@/lib/cookies';
import { TournamentsClient } from './tournaments-client';

export const dynamic = 'force-dynamic';

export default async function AdminTournamentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Get club memberships
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('club_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (!memberships || memberships.length === 0) {
    redirect('/dashboard');
  }

  const isSuperadmin = memberships.some((m: { role: string }) => m.role === 'superadmin');
  const firstClubId: string = memberships[0].club_id!;
  let clubId = firstClubId;
  if (isSuperadmin) {
    const cookieStore = await cookies();
    const selectedClub = cookieStore.get(ADMIN_CLUB_COOKIE)?.value;
    if (selectedClub) {
      clubId = selectedClub;
    }
  }

  // Fetch tournaments with error handling
  let tournaments: Parameters<typeof TournamentsClient>[0]['initialTournaments'] = [];
  try {
    const { data: tournamentsData, error: tournamentsError } = await supabase
      .from('tournaments')
      .select(
        'id, name, description, format, category, start_date, end_date, status, ' +
          'max_participants, registration_deadline, entry_fee'
      )
      .eq('club_id', clubId)
      .order('start_date', { ascending: true });

    if (tournamentsError) {
      console.error('[TournamentsPage] Query error:', tournamentsError);
    } else {
      tournaments = (tournamentsData || []) as unknown as typeof tournaments;
    }
  } catch (err) {
    console.error('[TournamentsPage] Unexpected error:', err);
  }

  return <TournamentsClient initialTournaments={tournaments} />;
}

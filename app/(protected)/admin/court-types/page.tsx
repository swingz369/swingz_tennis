import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { cookies } from 'next/headers';
import { CourtTypesClient } from './court-types-client';

export default async function AdminCourtTypesPage() {
  const cookieStore = await cookies();
  const hasDemoMode = cookieStore.get('demo-mode');

  if (!hasDemoMode) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: memberships } = await supabase
      .from('user_club_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true);

    type Membership = { role: string };
    const isAdmin = memberships?.some(
      (m: Membership) => m.role === 'admin' || m.role === 'superadmin'
    );
    if (!isAdmin) {
      redirect('/dashboard');
    }
  }

  return <CourtTypesClient />;
}

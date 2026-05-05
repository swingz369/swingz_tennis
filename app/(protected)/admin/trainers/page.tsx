import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { cookies } from 'next/headers';
import TrainerProfileManagement from '@/components/trainer-profile-management';

export default async function AdminTrainersPage() {
  const cookieStore = await cookies();
  const hasDemoMode = cookieStore.get('demo-mode');

  if (!hasDemoMode) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    // Optional: check if user has admin role
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
      // Not admin; could redirect or show error
      redirect('/dashboard');
    }
  }

  // Render the existing trainer profile management component
  return <TrainerProfileManagement />;
}

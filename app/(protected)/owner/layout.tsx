import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireAuth();

  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('role, club_id')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const isOwner = memberships?.some((m: { role: string }) => m.role === 'owner');

  if (!isOwner) {
    const roles = memberships?.map((m: { role: string }) => m.role) ?? [];
    if (roles.includes('superadmin')) redirect('/superadmin');
    else if (roles.includes('admin')) redirect('/admin');
    else redirect('/dashboard');
  }

  return <>{children}</>;
}

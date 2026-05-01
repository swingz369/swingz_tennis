import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { cookies } from 'next/headers';
import BrandingSettingsClient from './branding-client';

export default async function BrandingSettingsPage() {
  const cookieStore = await cookies();
  const hasDemoMode = cookieStore.get('demo-mode');

  // In demo mode, render client with demo club ID
  if (hasDemoMode) {
    return <BrandingSettingsClient clubId="demo" />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user's club memberships (admin role required)
  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('club_id, role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'superadmin'])
    .limit(1);

  if (!memberships || memberships.length === 0) {
    redirect('/dashboard'); // Not an admin
  }

  const clubId = memberships[0].club_id;

  return <BrandingSettingsClient clubId={clubId} />;
}

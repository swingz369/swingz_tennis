import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { MemberProfileClient } from './MemberProfileClient';

export default async function MemberProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Get the user's membership (only columns that exist in DB)
  const { data: membershipData } = await supabase
    .from('user_club_memberships')
    .select('id, club_id, role, joined_at, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1);

  const membership = (membershipData?.[0] ?? null) as {
    id: string;
    club_id: string;
    role: string;
    joined_at: string;
    is_active: boolean;
  } | null;

  if (!membership) {
    return (
      <div className="p-6 text-center text-gray-500">
        Kein aktiver Vereinszugang gefunden
      </div>
    );
  }

  // Fetch user profile from users table
  const { data: userData } = await supabase
    .from('users')
    .select(
      'id, full_name, email, phone, address, city, postal_code, date_of_birth, bio, emergency_contact, emergency_phone'
    )
    .eq('id', user.id)
    .single();

  const profile = userData as {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    date_of_birth: string | null;
    bio: string | null;
    emergency_contact: string | null;
    emergency_phone: string | null;
  } | null;

  const member = {
    id: membership.id,
    user_id: user.id,
    full_name: profile?.full_name || user.email || 'Mitglied',
    email: profile?.email || user.email || '',
    role: membership.role as 'member' | 'trainer' | 'admin' | 'superadmin',
    is_active: membership.is_active,
    include_in_planning: true,
    joined_at: membership.joined_at,
    phone: profile?.phone || null,
    address: profile?.address || null,
    city: profile?.city || null,
    postal_code: profile?.postal_code || null,
    date_of_birth: profile?.date_of_birth || null,
    bio: profile?.bio || null,
    emergency_contact: profile?.emergency_contact || null,
    emergency_phone: profile?.emergency_phone || null,
  };

  return <MemberProfileClient member={member} />;
}

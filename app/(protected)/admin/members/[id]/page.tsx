import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { MembersDetailClient } from './members-detail-client';
import type { Member } from '../member.types';

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let member: Member | null = null;
  let clubId: string | null = null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('user_club_memberships')
    .select('club_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1);

  if (!memberships || memberships.length === 0) {
    return <div className="p-6 text-red-600">Kein Vereinszugang gefunden</div>;
  }

  clubId = memberships[0].club_id;

  // Fetch membership data
  const { data: memberData } = await supabase
    .from('user_club_memberships')
    .select('id, user_id, role, joined_at, is_active')
    .eq('id', id)
    .single();

  if (!memberData) {
    return <div className="p-6 text-gray-500">Mitglied nicht gefunden</div>;
  }

  // Fetch user details separately
  const { data: userData } = await supabase
    .from('users')
    .select('id, full_name, email')
    .eq('id', memberData.user_id)
    .single();

  member = {
    id: memberData.id,
    user_id: memberData.user_id,
    full_name: userData?.full_name || 'Unbekannt',
    email: userData?.email || '',
    role: memberData.role,
    is_active: memberData.is_active,
    joined_at: memberData.joined_at,
  };

  if (!member) {
    return <div className="p-6 text-gray-500">Mitglied nicht gefunden</div>;
  }

  return <MembersDetailClient initialMember={member} clubId={clubId!} />;
}

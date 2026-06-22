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

  // Fetch membership data (include_in_planning not in generated types, use cast)
  const { data: memberData } = await (supabase.from('user_club_memberships') as any)
    .select(
      'id, user_id, role, joined_at, is_active, is_honorary, honorary_since, include_in_planning'
    )
    .eq('id', id)
    .single();

  if (!memberData) {
    return <div className="p-6 text-muted-foreground">Mitglied nicht gefunden</div>;
  }

  // Fetch full user details (extended fields available after migration)
  const { data: userData } = (await supabase
    .from('users')
    .select(
      'id, full_name, email, phone, address, city, postal_code, date_of_birth, bio, emergency_contact, emergency_phone'
    )
    .eq('id', memberData.user_id)
    .single()) as unknown as {
    data: {
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
  };

  member = {
    id: memberData.id,
    user_id: memberData.user_id,
    full_name: userData?.full_name || 'Unbekannt',
    email: userData?.email || '',
    role: memberData.role as 'member' | 'trainer' | 'admin' | 'superadmin',
    is_active: memberData.is_active,
    is_honorary: memberData.is_honorary ?? false,
    honorary_since: memberData.honorary_since ?? null,
    include_in_planning: memberData.include_in_planning ?? true,
    joined_at: memberData.joined_at,
    phone: userData?.phone || null,
    address: userData?.address || null,
    city: userData?.city || null,
    postal_code: userData?.postal_code || null,
    date_of_birth: userData?.date_of_birth || null,
    bio: userData?.bio || null,
    emergency_contact: userData?.emergency_contact || null,
    emergency_phone: userData?.emergency_phone || null,
  };

  if (!member) {
    return <div className="p-6 text-muted-foreground">Mitglied nicht gefunden</div>;
  }

  return <MembersDetailClient initialMember={member} clubId={clubId!} />;
}

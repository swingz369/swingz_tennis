import { redirect } from 'next/navigation';
import { createClient } from '@/infrastructure/external/supabase/server';
import { cookies } from 'next/headers';
import { MembersDetailClient } from './members-detail-client';
import type { Member } from '../member.types';

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const hasDemoMode = cookieStore.get('demo-mode');

  let member: Member | null = null;
  let clubId: string | null = null;

  if (hasDemoMode) {
    const demoMembers: Member[] = [
      {
        id: '1',
        user_id: '1',
        full_name: 'Max Mustermann',
        email: 'max@example.com',
        role: 'member',
        is_active: true,
        joined_at: '2025-01-15',
      },
      {
        id: '2',
        user_id: '2',
        full_name: 'Anna Schmidt',
        email: 'anna@example.com',
        role: 'member',
        is_active: true,
        joined_at: '2025-02-20',
      },
      {
        id: '3',
        user_id: '3',
        full_name: 'Tom Müller',
        email: 'tom@example.com',
        role: 'trainer',
        is_active: true,
        joined_at: '2025-03-10',
      },
      {
        id: '4',
        user_id: '4',
        full_name: 'Lisa Weber',
        email: 'lisa@example.com',
        role: 'member',
        is_active: false,
        joined_at: '2025-01-05',
      },
    ];
    member = demoMembers.find((m) => m.id === id) || null;
    clubId = 'demo-club';
  } else {
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

    const { data: memberData } = await supabase
      .from('user_club_memberships')
      .select(
        `
        id,
        user_id,
        role,
        joined_at,
        is_active,
        users (
          id,
          full_name,
          email
        )
      `
      )
      .eq('id', id)
      .single();

    if (!memberData) {
      return <div className="p-6 text-gray-500">Mitglied nicht gefunden</div>;
    }

    member = {
      id: memberData.id,
      user_id: memberData.user_id,
      full_name: memberData.users?.full_name || 'Unbekannt',
      email: memberData.users?.email || '',
      role: memberData.role,
      is_active: memberData.is_active,
      joined_at: memberData.joined_at,
    };
  }

  if (!member) {
    return <div className="p-6 text-gray-500">Mitglied nicht gefunden</div>;
  }

  return <MembersDetailClient initialMember={member} clubId={clubId!} />;
}

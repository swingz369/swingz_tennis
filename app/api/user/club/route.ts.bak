import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    // Demo mode early return
    const cookieStore = await cookies();
    const hasDemoMode = cookieStore.get('demo-mode');
    if (hasDemoMode) {
      return NextResponse.json({
        clubId: 'demo-club',
        club: { id: 'demo-club', name: 'Demo Tennis Club', maxMembers: 100, status: 'active' },
      });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: memberships, error: membershipError } = await supabase
      .from('user_club_memberships')
      .select('club_id, clubs (id, name, max_members, status)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1);

    if (membershipError || !memberships || memberships.length === 0) {
      return NextResponse.json({ error: 'No club membership found' }, { status: 404 });
    }

    const membership = memberships[0];
    const club = membership.clubs as {
      id: string;
      name: string;
      max_members: number;
      status: string;
    };
    return NextResponse.json({
      clubId: membership.club_id,
      club: { id: club.id, name: club.name, maxMembers: club.max_members, status: club.status },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error fetching user club:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

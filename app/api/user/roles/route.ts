import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const hasDemoMode = cookieStore.get('demo-mode');
    if (hasDemoMode) {
      return NextResponse.json({
        roles: ['admin'],
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

    const { data: rolesData, error: rolesError } = await supabase
      .from('user_club_memberships')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
    }

    const roles = (rolesData as Array<{ role: string }>).map((m) => m.role);
    return NextResponse.json({ roles });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error fetching user roles:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return member details (Supabase user ID is the member ID)
    return NextResponse.json({
      memberId: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Member',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error fetching member:', error);
    return NextResponse.json({ error: message || 'Internal server error' }, { status: 500 });
  }
}

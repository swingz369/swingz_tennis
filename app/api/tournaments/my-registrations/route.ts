/**
 * GET /api/tournaments/my-registrations — get current user's tournament registrations
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Authentication required');

    const { supabase, user } = auth;

    const { data, error } = await supabase
      .from('tournament_registrations')
      .select('id, tournament_id, status, registration_date, payment_status')
      .eq('user_id', user.id)
      .order('registration_date', { ascending: false });

    if (error) {
      console.error('my-registrations GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch registrations' }, { status: 500 });
    }

    return NextResponse.json({ registrations: data ?? [] });
  });
}

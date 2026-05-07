/**
 * GET /api/trainers — list trainers in the user's club
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Authentication required');

    const { supabase, clubId } = auth;

    if (!clubId) {
      return NextResponse.json({ trainers: [] });
    }

    // Fetch trainer memberships for this club
    const { data, error } = await supabase
      .from('user_club_memberships')
      .select(
        `id, user_id,
         users(id, full_name, email)`
      )
      .eq('club_id', clubId)
      .eq('role', 'trainer')
      .eq('is_active', true);

    if (error) {
      console.error('trainers GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch trainers' }, { status: 500 });
    }

    // Also try to get trainer profile specialties
    const trainerIds = (data ?? []).map((m: any) => m.user_id);
    const profileMap: Record<string, any> = {};

    if (trainerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('trainer_profiles' as any)
        .select('user_id, specialties, bio')
        .in('user_id', trainerIds)
        .catch(() => ({ data: null }));

      (profiles ?? []).forEach((p: any) => {
        profileMap[p.user_id] = p;
      });
    }

    const trainers = (data ?? []).map((m: any) => {
      const u = Array.isArray(m.users) ? m.users[0] : m.users;
      const profile = profileMap[m.user_id] ?? {};
      return {
        id: m.user_id,
        full_name: u?.full_name ?? 'Trainer',
        email: u?.email ?? '',
        specialties: profile.specialties ?? [],
        bio: profile.bio ?? null,
      };
    });

    return NextResponse.json({ trainers });
  });
}

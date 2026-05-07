import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await _request.json();
      const { userId, status } = body;

      if (!userId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 });
      }

      const clubId = auth.clubId;
      if (!clubId) {
        return NextResponse.json({ error: 'No club context' }, { status: 400 });
      }

      // Update the trainer's status in user_club_memberships or a trainer_profiles table
      const { data, error } = await auth.supabase
        .from('user_club_memberships')
        .update({ ...(status ? { status } : {}) })
        .eq('user_id', userId)
        .eq('club_id', clubId)
        .eq('role', 'trainer')
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, trainerProfile: data });
    } catch (error) {
      console.error('Trainer profile creation error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer or admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const supabase = auth.supabase;

      // Determine which club to fetch trainers for
      const clubId = auth.clubId;
      if (!clubId) {
        return NextResponse.json({ profiles: [] });
      }

      // Fetch all active trainers in this club from memberships + user data
      const { data: memberships, error: membershipsError } = await supabase
        .from('user_club_memberships')
        .select('user_id, created_at, is_active')
        .eq('club_id', clubId)
        .eq('role', 'trainer')
        .eq('is_active', true);

      if (membershipsError) {
        console.error('Trainer memberships fetch error:', membershipsError);
        return NextResponse.json({ error: membershipsError.message }, { status: 500 });
      }

      if (!memberships || memberships.length === 0) {
        return NextResponse.json({ profiles: [] });
      }

      const trainerUserIds = memberships.map((m: any) => m.user_id);

      // Fetch user details
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, email, phone, created_at')
        .in('id', trainerUserIds);

      if (usersError) {
        console.error('Trainer users fetch error:', usersError);
        return NextResponse.json({ error: usersError.message }, { status: 500 });
      }

      const usersMap = new Map((users ?? []).map((u: any) => [u.id, u]));

      // Build trainer profile objects from membership + user data
      const profiles = memberships.map((m: any) => {
        const user = usersMap.get(m.user_id) as any;
        const nameParts = (user?.full_name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        return {
          id: m.user_id,
          userId: m.user_id,
          firstName,
          lastName,
          email: user?.email || '',
          phone: user?.phone || '',
          dateOfBirth: '1990-01-01',
          status: 'active' as const,
          qualifications: [],
          specializations: [],
          experience: { years: 0, previousClubs: [], achievements: [] },
          availability: {
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: false,
            sunday: false,
          },
          preferredTimeSlots: [],
          languages: ['Deutsch'],
          emergencyContact: { name: '', phone: '', relationship: '' },
          createdAt: m.created_at,
          updatedAt: m.created_at,
        };
      });

      return NextResponse.json({ profiles });
    } catch (error) {
      console.error('Trainer profile fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

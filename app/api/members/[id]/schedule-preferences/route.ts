import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import type { NextRequest } from 'next/server';
import { withApiAuth, verifyRole } from '@/lib/api-auth';
import type { AuthContext } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:members:[id]:schedule-preferences');

// ponytail: eigener User, admin (global), oder trainer/admin desselben Clubs
async function canAccess(auth: AuthContext, userId: string, clubId: string): Promise<boolean> {
  if (auth.user.id === userId) return true;
  if (await verifyRole(auth, 'admin')) return true;
  return auth.memberships.some(
    (m) => m.club_id === clubId && (m.role === 'trainer' || m.role === 'admin')
  );
}

/**
 * GET /api/members/[userId]/schedule-preferences?clubId=...
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params;
  return withApiAuth(request, async (auth) => {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get('clubId');

    if (!clubId) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
    }

    if (!(await canAccess(auth, userId, clubId))) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('member_schedule_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('club_id', clubId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      log.error('Failed to fetch schedule preferences:', error);
      return internalErrorResponse();
    }

    return NextResponse.json({
      preferences: data ?? {
        preferred_level: null,
        preferred_age_group: null,
        weekly_availability: {
          monday: [],
          tuesday: [],
          wednesday: [],
          thursday: [],
          friday: [],
          saturday: [],
          sunday: [],
        },
        wish_partner_ids: [],
        preferred_trainer_ids: [],
        preferred_court_ids: [],
        max_sessions_per_week: null,
        special_requests: null,
        notes: null,
      },
    });
  });
}

/**
 * PUT /api/members/[userId]/schedule-preferences
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = await params;
  return withApiAuth(request, async (auth) => {
    const body = await request.json();
    const {
      clubId,
      preferred_level,
      preferred_age_group,
      weekly_availability,
      wish_partner_ids,
      preferred_trainer_ids,
      preferred_court_ids,
      max_sessions_per_week,
      special_requests,
      notes,
    } = body;

    if (!clubId) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
    }

    if (!(await canAccess(auth, userId, clubId))) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }

    const supabase = createServiceClient();

    // Upsert: check if exists first
    const { data: existing } = await supabase
      .from('member_schedule_preferences')
      .select('id')
      .eq('user_id', userId)
      .eq('club_id', clubId)
      .maybeSingle();

    const payload = {
      user_id: userId,
      club_id: clubId,
      preferred_level: preferred_level || null,
      preferred_age_group: preferred_age_group || null,
      weekly_availability: weekly_availability || {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: [],
      },
      wish_partner_ids: wish_partner_ids || [],
      preferred_trainer_ids: preferred_trainer_ids || [],
      preferred_court_ids: preferred_court_ids || [],
      max_sessions_per_week: max_sessions_per_week || null,
      special_requests: special_requests || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      result = await supabase
        .from('member_schedule_preferences')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('member_schedule_preferences')
        .insert({ ...payload, created_at: new Date().toISOString() })
        .select()
        .single();
    }

    if (result.error) {
      log.error('Failed to save schedule preferences:', result.error);
      return internalErrorResponse();
    }

    return NextResponse.json({ success: true, preferences: result.data });
  });
}

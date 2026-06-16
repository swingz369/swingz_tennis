import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:members:[id]:schedule-preferences');

/**
 * GET /api/members/[userId]/schedule-preferences?clubId=...
 * Fetches a member's general schedule preferences
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: userId } = await params;
    const { searchParams } = new URL(_request.url);
    const clubId = searchParams.get('clubId');

    if (!clubId) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
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
      return NextResponse.json({ error: error.message }, { status: 500 });
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
  } catch (error) {
    log.error('Schedule preferences GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/members/[userId]/schedule-preferences
 * Creates or updates a member's general schedule preferences
 */
export async function PUT(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: userId } = await params;
    const body = await _request.json();
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
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, preferences: result.data });
  } catch (error) {
    log.error('Schedule preferences PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

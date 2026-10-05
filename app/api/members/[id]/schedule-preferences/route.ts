import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import type { NextRequest } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import type { AuthContext } from '@/lib/api-auth';
import { getUserDb, systemDb } from '@/infrastructure/db';
import { createLogger } from '@/lib/logger';
import { uuidSchema } from '@/application/validation/schemas';

const log = createLogger('api:members:[id]:schedule-preferences');

// Eigener User, Owner, oder Admin/Superadmin genau dieses Vereins
async function canAccess(auth: AuthContext, userId: string, clubId: string): Promise<boolean> {
  if (auth.user.id === userId || auth.role === 'owner') return true;
  return auth.memberships.some(
    (m) => m.club_id === clubId && (m.role === 'admin' || m.role === 'superadmin')
  );
}

/**
 * Lesen und Ändern deckt RLS für den Nutzer selbst und Vereinsadmins ab; anlegen
 * darf per RLS nur der Nutzer selbst. Admins (für ein Mitglied) und der Owner
 * schreiben deshalb über systemDb — canAccess hat den Verein vorher geprüft.
 */
function db(auth: AuthContext, userId: string) {
  return auth.user.id === userId
    ? getUserDb(auth)
    : systemDb('Admin pflegt Trainingswünsche eines Mitglieds');
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
      return NextResponse.json({ error: 'clubId erforderlich' }, { status: 400 });
    }
    if (!uuidSchema.safeParse(clubId).success || !uuidSchema.safeParse(userId).success) {
      return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });
    }

    if (!(await canAccess(auth, userId, clubId))) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }

    const supabase = db(auth, userId);
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
      return NextResponse.json({ error: 'clubId erforderlich' }, { status: 400 });
    }
    if (!uuidSchema.safeParse(clubId).success || !uuidSchema.safeParse(userId).success) {
      return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 });
    }

    if (!(await canAccess(auth, userId, clubId))) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }

    const supabase = db(auth, userId);

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

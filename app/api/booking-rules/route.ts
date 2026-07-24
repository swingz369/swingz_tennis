/**
 * GET  /api/booking-rules?clubId=xxx — Returns booking rules for a club
 * POST /api/booking-rules             — Creates or updates booking rules for a club
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:booking-rules');

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) return forbiddenResponse('Admin access required');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const url = new URL(req.url);
    // auth.clubId was resolved by withApiAuth → buildAuthContext → resolveActiveClub,
    // which honors ADMIN_CLUB_COOKIE for superadmin (club-exists strategy) and admins
    // (membership-match). Query param still wins for explicit overrides.
    const clubId = url.searchParams.get('clubId') ?? auth.clubId;
    if (!clubId) return NextResponse.json({ error: 'clubId required' }, { status: 400 });

    const { data, error } = await auth.supabase
      .from('booking_rules')
      .select('*')
      .eq('club_id', clubId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      log.error('[BookingRules GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return defaults if no rules found
    if (!data) {
      return NextResponse.json({
        club_id: clubId,
        max_booking_duration_minutes: 90,
        advance_booking_days: 14,
        max_bookings_per_week: 3,
        is_active: true,
      });
    }

    return NextResponse.json(data);
  });
}

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    if (!isAdmin) return forbiddenResponse('Admin access required');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    // auth.clubId is the cookie-aware resolution result (see comment in GET).
    const clubId: string | null = body.clubId ?? auth.clubId;
    if (!clubId) return NextResponse.json({ error: 'clubId required' }, { status: 400 });

    const {
      max_booking_duration_minutes = 90,
      advance_booking_days = 14,
      max_bookings_per_week = 3,
      max_bookings_per_day,
      allow_recurring,
      cancellation_hours_before,
    } = body;

    // Check if rules already exist for this club
    const { data: existing } = await auth.supabase
      .from('booking_rules')
      .select('id')
      .eq('club_id', clubId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    let result;
    if (existing?.id) {
      // Update existing
      const { data, error } = await auth.supabase
        .from('booking_rules')
        .update({
          max_booking_duration_minutes,
          advance_booking_days,
          max_bookings_per_week,
          ...(max_bookings_per_day !== undefined && { max_bookings_per_day }),
          ...(allow_recurring !== undefined && { allow_recurring }),
          ...(cancellation_hours_before !== undefined && { cancellation_hours_before }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) {
        log.error('[BookingRules PATCH]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      result = data;
    } else {
      // Create new
      const { data, error } = await auth.supabase
        .from('booking_rules')
        .insert({
          club_id: clubId,
          name: 'Standard',
          max_booking_duration_minutes,
          advance_booking_days,
          max_bookings_per_week,
          ...(max_bookings_per_day !== undefined && { max_bookings_per_day }),
          ...(allow_recurring !== undefined && { allow_recurring }),
          ...(cancellation_hours_before !== undefined && { cancellation_hours_before }),
          is_active: true,
        })
        .select()
        .single();
      if (error) {
        log.error('[BookingRules POST]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      result = data;
    }

    return NextResponse.json({ success: true, bookingRules: result });
  });
}

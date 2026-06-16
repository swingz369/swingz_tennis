import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:qr-checkin');

/**
 * QR Code Check-in API
 * Members scan a QR code at the court to check in. The QR code encodes a session ID.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { sessionId, qrToken } = await request.json();

    if (!sessionId && !qrToken) {
      return NextResponse.json({ error: 'Session-ID oder QR-Token erforderlich' }, { status: 400 });
    }

    // Decode QR token if provided
    let resolvedSessionId = sessionId;
    if (qrToken) {
      try {
        const decoded = JSON.parse(Buffer.from(qrToken, 'base64').toString());
        resolvedSessionId = decoded.sessionId;
      } catch {
        return NextResponse.json({ error: 'Ungültiger QR-Code' }, { status: 400 });
      }
    }

    // Verify session exists
    const { data: session } = await supabase
      .from('sessions')
      .select('id, timeslot_start, timeslot_end, court_id')
      .eq('id', resolvedSessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session nicht gefunden' }, { status: 404 });
    }

    // Check if session is today
    const sessionDate = new Date(session.timeslot_start);
    const now = new Date();
    const isToday =
      sessionDate.getDate() === now.getDate() &&
      sessionDate.getMonth() === now.getMonth() &&
      sessionDate.getFullYear() === now.getFullYear();

    if (!isToday) {
      return NextResponse.json(
        { error: 'Check-in nur am Tag der Session möglich' },
        { status: 400 }
      );
    }

    // Check if user has a booking for this session
    const { data: booking } = await supabase
      .from('bookings')
      .select('id')
      .eq('session_id', resolvedSessionId)
      .eq('member_id', user.id)
      .eq('status', 'confirmed')
      .maybeSingle();

    if (!booking) {
      return NextResponse.json(
        { error: 'Keine bestätigte Buchung für diese Session' },
        { status: 403 }
      );
    }

    // Check for duplicate check-in
    const { data: existingCheckin } = await (supabase as any)
      .from('qr_checkins')
      .select('id')
      .eq('session_id', resolvedSessionId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingCheckin) {
      return NextResponse.json({ alreadyCheckedIn: true, message: 'Bereits eingecheckt' });
    }

    // Record check-in
    const { error } = await (supabase as any).from('qr_checkins').insert({
      session_id: resolvedSessionId,
      user_id: user.id,
      booking_id: booking.id,
      checked_in_at: new Date().toISOString(),
    });

    if (error) throw error;

    // Award gamification points (non-blocking, uses admin client for RLS bypass)
    let pointsAwarded = false;
    try {
      const adminSupabase = createServiceClient();
      const { data: existingPoints } = await (adminSupabase as any)
        .from('gamification_points')
        .select('points')
        .eq('user_id', user.id)
        .maybeSingle();

      const currentPoints = existingPoints?.points || 0;
      await (adminSupabase as any)
        .from('gamification_points')
        .upsert({ user_id: user.id, points: currentPoints + 10 }, { onConflict: 'user_id' });
      pointsAwarded = true;
    } catch (e) {
      log.error('Gamification points award failed:', e);
    }

    return NextResponse.json({
      success: true,
      message: `Check-in erfolgreich!${pointsAwarded ? ' +10 Punkte' : ''}`,
      pointsAwarded,
      session: {
        startTime: session.timeslot_start,
        endTime: session.timeslot_end,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET: Generate QR code for a session (admin/trainer)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sessionId = request.nextUrl.searchParams.get('sessionId');
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId Parameter erforderlich' }, { status: 400 });
    }

    const qrToken = Buffer.from(JSON.stringify({ sessionId, timestamp: Date.now() })).toString(
      'base64'
    );

    // Return the token — frontend renders QR code from this
    return NextResponse.json({ qrToken, sessionId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

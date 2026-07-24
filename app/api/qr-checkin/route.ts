import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:qr-checkin');

/**
 * QR Code Check-in API
 * Members scan a QR code at the court to check in. The QR code encodes a session ID.
 */
export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const { supabase, user } = auth;

    const { sessionId, qrToken } = await request.json();

    if (!sessionId && !qrToken) {
      return NextResponse.json({ error: 'Session-ID oder QR-Token erforderlich' }, { status: 400 });
    }

    // Decode QR token if provided
    let resolvedSessionId = sessionId;
    let tokenUserId: string | null = null;
    if (qrToken) {
      try {
        const decoded = JSON.parse(Buffer.from(qrToken, 'base64').toString());
        resolvedSessionId = decoded.sessionId;
        // Extract the generator's userId from the token payload. The POST
        // handler verifies this matches the scanning user to prevent token
        // sharing / cross-user check-in. (Sprint 4 audit fix.)
        tokenUserId = typeof decoded.userId === 'string' ? decoded.userId : null;
      } catch {
        return NextResponse.json({ error: 'Ungültiger QR-Code' }, { status: 400 });
      }
    }

    // Verify the token is bound to the scanning user. Without this check,
    // any logged-in user could call GET to generate a valid token, then
    // share it (or use it themselves to check into a session they're
    // not authorized for). The binding ensures tokens are only usable
    // by their generator.
    //
    // Note: `tokenUserId === null` is ALSO rejected (fails closed). Tokens
    // without a userId are either pre-fix legacy tokens or attacker-crafted
    // payloads — both must be rejected. (Sprint 4 audit fix.)
    if (tokenUserId === null || tokenUserId !== user.id) {
      return NextResponse.json(
        { error: 'QR-Code wurde für einen anderen Benutzer generiert' },
        { status: 403 }
      );
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
      log.error('Gamification points award failed', e);
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
  });
}

// GET: Generate QR code for a session (any logged-in user; token is bound
// to the generator's userId and verified on POST)
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const sessionId = request.nextUrl.searchParams.get('sessionId');
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId Parameter erforderlich' }, { status: 400 });
    }

    // Bind the token to the generator's userId. The POST handler verifies this
    // matches the scanner, preventing one user from generating a valid token
    // that another user could use to check in. (Sprint 4 audit fix — closes
    // the regression introduced when _auth was discarded.)
    const qrToken = Buffer.from(
      JSON.stringify({
        sessionId,
        timestamp: Date.now(),
        userId: auth.user.id,
      })
    ).toString('base64');

    // Return the token — frontend renders QR code from this
    return NextResponse.json({ qrToken, sessionId });
  });
}

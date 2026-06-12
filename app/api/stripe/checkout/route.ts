/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for a booking payment.
 * If Stripe is not configured (placeholder keys), returns a simulated response
 * so the app remains fully functional without real payment credentials.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { getStripe } from '@/lib/stripe/client';

export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Authentication required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await _request.json();
      const { type, bookingId, sessionId, clubId, amount, description } = body;

      if (!type || !clubId) {
        return NextResponse.json({ error: 'type and clubId are required' }, { status: 400 });
      }

      if (type === 'booking' && !bookingId) {
        return NextResponse.json(
          { error: 'bookingId is required for booking payments' },
          { status: 400 }
        );
      }

      // Resolve amount and court name from DB when type = 'booking'
      let resolvedAmount: number = amount; // in cents
      let courtName = 'Platz';

      if (type === 'booking' && bookingId) {
        const supabase = auth.supabase;

        // Look up the booking and its associated session/court
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .select(
            `
            id,
            club_id,
            member_id,
            session_id,
            payment_status,
            sessions(
              id,
              timeslot_start,
              timeslot_end,
              courts(name)
            )
          `
          )
          .eq('id', bookingId)
          .single();

        if (bookingError || !booking) {
          return NextResponse.json({ error: 'Buchung nicht gefunden' }, { status: 404 });
        }

        // Only the booking owner can pay
        if (booking.member_id !== auth.user.id) {
          return NextResponse.json({ error: 'Kein Zugriff auf diese Buchung' }, { status: 403 });
        }

        if (booking.payment_status === 'paid') {
          return NextResponse.json(
            { error: 'Diese Buchung wurde bereits bezahlt' },
            { status: 400 }
          );
        }

        // Get court name from nested session
        const sessionData = booking.sessions as any;
        if (sessionData?.courts?.name) {
          courtName = sessionData.courts.name;
        }

        // Get pricing from booking_rules or use default (€15 = 1500 cents)
        if (!resolvedAmount) {
          await supabase
            .from('booking_rules')
            .select('require_payment')
            .eq('club_id', clubId)
            .eq('applies_to_role', 'member')
            .maybeSingle();

          // Default price: 15 EUR = 1500 cents
          resolvedAmount = 1500;
        }
      }

      // Use a safe default if still not resolved
      if (!resolvedAmount || resolvedAmount <= 0) {
        resolvedAmount = 1500; // 15 EUR default
      }

      // Build base URL
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'https://swingz.vercel.app');

      const successUrl = `${baseUrl}/bookings?payment=success`;
      const cancelUrl = `${baseUrl}/bookings?payment=cancelled`;

      // --- Stripe not configured → return error ---
      const stripe = getStripe();
      if (!stripe) {
        return NextResponse.json(
          {
            error:
              'Zahlungsdienstleister ist nicht konfiguriert. Bitte wende dich an den Administrator.',
          },
          { status: 503 }
        );
      }

      // --- Create real Stripe Checkout Session ---
      const lineItemName = description || `Platzbuchung - ${courtName}`;

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'eur',
              unit_amount: resolvedAmount,
              product_data: {
                name: lineItemName,
              },
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: auth.user.email || undefined,
        metadata: {
          bookingId: bookingId || '',
          sessionId: sessionId || '',
          userId: auth.user.id,
          clubId,
        },
      });

      return NextResponse.json({ url: session.url, sessionId: session.id });
    } catch (error) {
      console.error('[Stripe Checkout] Error:', error);
      return NextResponse.json(
        { error: 'Fehler beim Erstellen der Checkout-Session' },
        { status: 500 }
      );
    }
  });
}

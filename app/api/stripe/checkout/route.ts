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
import { createLogger } from '@/lib/logger';
import { appBaseUrl } from '@/lib/app-url';
import { PricingRuleService } from '@/application/services/pricing-rule.service';
import { ClubId, CourtId } from '@/domain/value-objects';

const log = createLogger('api:stripe:checkout');
export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Anmeldung erforderlich');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await _request.json();
      const { type, bookingId, sessionId, clubId, description } = body;

      if (!type || !clubId) {
        return NextResponse.json({ error: 'type und clubId sind erforderlich' }, { status: 400 });
      }

      if (type === 'booking' && !bookingId) {
        return NextResponse.json(
          { error: 'bookingId ist für Buchungszahlungen erforderlich' },
          { status: 400 }
        );
      }

      // Der Preis wird serverseitig ermittelt — niemals aus dem Client-Body.
      // Basis ist der Stundenpreis des Platztyps (0 = kostenlos), darüber werden
      // aktive pricing_rules angewendet (z. B. Winter-Zuschlag). Ein stiller
      // €15-Default existiert nicht mehr.
      let resolvedAmount = 0; // in cents
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
            court_id,
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

        // Preis ermitteln: Basis = Stundenpreis des Platztyps, darüber pricing_rules.
        if (!sessionData?.timeslot_start || !sessionData?.timeslot_end) {
          return NextResponse.json(
            { error: 'Buchungszeitraum fehlt — Preis kann nicht ermittelt werden' },
            { status: 400 }
          );
        }

        const sessionStart = new Date(sessionData.timeslot_start);
        const sessionEnd = new Date(sessionData.timeslot_end);
        const bookingHours = (sessionEnd.getTime() - sessionStart.getTime()) / 3_600_000;

        let basePricePerHour = 0;
        if (booking.court_id) {
          const { data: court } = await supabase
            .from('courts')
            .select('court_type_id')
            .eq('id', booking.court_id)
            .maybeSingle();
          if (court?.court_type_id) {
            const { data: courtType } = await supabase
              .from('court_types')
              .select('hourly_rate')
              .eq('id', court.court_type_id)
              .maybeSingle();
            basePricePerHour = Number(courtType?.hourly_rate ?? 0);
          }
        }

        const pricing = await new PricingRuleService(auth).calculatePrice(
          ClubId.fromString(booking.club_id),
          {
            courtId: booking.court_id ? CourtId.fromString(booking.court_id) : undefined,
            startTime: sessionStart,
            dayOfWeek: sessionStart.getDay(),
            bookingHours,
            basePricePerHour,
          }
        );

        const effectivePricePerHour = pricing.pricePerHour * pricing.multiplier;
        resolvedAmount = Math.round(effectivePricePerHour * bookingHours * 100);
      }

      // Ohne fälligen Betrag gibt es nichts zu belasten — keinen Default erfinden.
      if (!resolvedAmount || resolvedAmount <= 0) {
        return NextResponse.json(
          {
            error:
              'Kein fälliger Betrag — die Buchung ist kostenlos oder der Preis konnte nicht ermittelt werden.',
          },
          { status: 400 }
        );
      }

      // Build base URL
      const baseUrl = appBaseUrl(
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined
      );

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

      const session = await stripe.checkout.sessions.create(
        {
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
        },
        {
          // Wiederholte Klicks erzeugen keine doppelten Checkout-Sessions.
          idempotencyKey: `booking-checkout-${bookingId}`,
        }
      );

      return NextResponse.json({ url: session.url, sessionId: session.id });
    } catch (error) {
      log.error('[Stripe Checkout] Error:', error);
      return NextResponse.json(
        { error: 'Fehler beim Erstellen der Checkout-Session' },
        { status: 500 }
      );
    }
  });
}

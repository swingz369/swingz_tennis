import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Type guard: validates URL format and protocol
function isValidUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export async function POST(_request: NextRequest) {
  try {
    const body = await _request.json();
    const event = body;

    // In production, validate webhook signature
    // if (process.env.NODE_ENV === 'production') {
    //   const signature = _request.headers.get('zapier-signature');
    //   // Validate signature
    // }

    switch (event.type) {
      case 'booking.created':
        await handleBookingCreated(event.data);
        break;
      case 'booking.updated':
        await handleBookingUpdated(event.data);
        break;
      case 'booking.cancelled':
        await handleBookingCancelled(event.data);
        break;
      default:
        return NextResponse.json({ received: true, event: event.type });
    }

    return NextResponse.json({ received: true, event: event.type });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

async function handleBookingCreated(booking: Record<string, unknown>) {
  const { memberId, memberEmail, memberName, courtName, startTime, endTime } = booking;

  // Forward to Zapier webhook URL if configured and valid
  const zapierUrl = process.env.ZAPIER_WEBHOOK_URL;
  if (isValidUrl(zapierUrl)) {
    try {
      await fetch(zapierUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'booking.created',
          memberId,
          memberEmail,
          memberName,
          courtName,
          startTime,
          endTime,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error('Failed to forward to Zapier:', err);
    }
  }
}

async function handleBookingUpdated(booking: Record<string, unknown>) {
  const { memberId, memberEmail, memberName, courtName, startTime, endTime } = booking;

  const zapierUrl = process.env.ZAPIER_WEBHOOK_URL;
  if (isValidUrl(zapierUrl)) {
    try {
      await fetch(zapierUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'booking.updated',
          memberId,
          memberEmail,
          memberName,
          courtName,
          startTime,
          endTime,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error('Failed to forward to Zapier:', err);
    }
  }
}

async function handleBookingCancelled(booking: Record<string, unknown>) {
  const { memberId, memberEmail, memberName, courtName, startTime, endTime, cancellationReason } =
    booking;

  const zapierUrl = process.env.ZAPIER_WEBHOOK_URL;
  if (isValidUrl(zapierUrl)) {
    try {
      await fetch(zapierUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'booking.cancelled',
          memberId,
          memberEmail,
          memberName,
          courtName,
          startTime,
          endTime,
          cancellationReason,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error('Failed to forward to Zapier:', err);
    }
  }
}

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event = body;

    // In production, validate webhook signature
    // if (process.env.NODE_ENV === 'production') {
    //   const signature = request.headers.get('zapier-signature');
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

  // Forward to Zapier webhook URL if configured
  const zapierUrl = process.env.ZAPIER_WEBHOOK_URL;
  if (zapierUrl) {
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

  // Optional: Send email notifications
  // await sendEmailNotification(memberEmail, 'booking_created', { ... });
}

async function handleBookingUpdated(booking: Record<string, unknown>) {
  const { memberId, memberEmail, memberName, courtName, startTime, endTime } = booking;

  const zapierUrl = process.env.ZAPIER_WEBHOOK_URL;
  if (zapierUrl) {
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
  if (zapierUrl) {
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

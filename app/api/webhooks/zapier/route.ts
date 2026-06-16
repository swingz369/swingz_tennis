import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { apiFetch } from '@/lib/api-fetch';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:webhooks:zapier');

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

/**
 * Verify Zapier webhook signature
 * SECURITY FIX: Prevents unauthorized webhook calls
 */
function verifyZapierSignature(request: NextRequest, body: string): boolean {
  // Skip verification in development for easier testing
  if (process.env.NODE_ENV !== 'production') {
    // Signature verification skipped in non-production environments
    return true;
  }

  const signature = request.headers.get('x-zapier-signature');
  const secret = process.env.ZAPIER_WEBHOOK_SECRET;

  if (!signature || !secret) {
    log.error('Missing signature or secret for Zapier webhook');
    return false;
  }

  try {
    // Zapier uses HMAC-SHA256 for webhook signatures
    const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch (error) {
    log.error('Error verifying Zapier signature:', error);
    return false;
  }
}

export async function POST(_request: NextRequest) {
  try {
    // SECURITY: Rate limiting - 10 requests per minute
    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    // SECURITY FIX: Read body as text first for signature verification
    const body = await _request.text();

    // Verify signature before processing
    if (!verifyZapierSignature(_request, body)) {
      log.error('Invalid Zapier webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse JSON after signature verification
    const event = JSON.parse(body);

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
    log.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

async function handleBookingCreated(booking: Record<string, unknown>) {
  const { memberId, memberEmail, memberName, courtName, startTime, endTime } = booking;

  // Forward to Zapier webhook URL if configured and valid
  const zapierUrl = process.env.ZAPIER_WEBHOOK_URL;
  if (isValidUrl(zapierUrl)) {
    try {
      await apiFetch(zapierUrl, {
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
      log.error('Failed to forward to Zapier:', err);
    }
  }
}

async function handleBookingUpdated(booking: Record<string, unknown>) {
  const { memberId, memberEmail, memberName, courtName, startTime, endTime } = booking;

  const zapierUrl = process.env.ZAPIER_WEBHOOK_URL;
  if (isValidUrl(zapierUrl)) {
    try {
      await apiFetch(zapierUrl, {
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
      log.error('Failed to forward to Zapier:', err);
    }
  }
}

async function handleBookingCancelled(booking: Record<string, unknown>) {
  const { memberId, memberEmail, memberName, courtName, startTime, endTime, cancellationReason } =
    booking;

  const zapierUrl = process.env.ZAPIER_WEBHOOK_URL;
  if (isValidUrl(zapierUrl)) {
    try {
      await apiFetch(zapierUrl, {
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
      log.error('Failed to forward to Zapier:', err);
    }
  }
}

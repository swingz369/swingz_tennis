/**
 * Push Notification Subscription API
 *
 * POST   /api/push/subscribe    — Subscribe to push notifications
 * DELETE /api/push/subscribe    — Unsubscribe from push notifications
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { pushNotificationService } from '@/lib/push-notification.service';

// ─── POST /api/push/subscribe ─────────────────────────────────────────

const subscribeBodySchema = z.object({
  endpoint: z.string().url('endpoint muss eine gültige URL sein').max(500),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
});

const unsubscribeBodySchema = z.object({
  endpoint: z.string().url().max(500),
});

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Anmeldung erforderlich');

    const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    const body = await req.json().catch(() => null);
    const parsed = subscribeBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ungültiger Request-Body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { endpoint, p256dh, auth: authKey } = parsed.data;

    // Determine clubId
    let clubId = auth.clubId;
    if (!clubId) {
      const { data: membership } = await auth.supabase
        .from('user_club_memberships')
        .select('club_id')
        .eq('user_id', auth.user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      clubId = membership?.club_id ?? null;
    }

    if (!clubId) {
      return NextResponse.json({ error: 'Kein Club-Kontext gefunden' }, { status: 400 });
    }

    const result = await pushNotificationService.subscribe({
      userId: auth.user.id,
      clubId,
      endpoint,
      p256dh,
      auth: authKey,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    if (!result.success) {
      return internalErrorResponse();
    }

    return NextResponse.json({
      success: true,
      subscriptionId: result.subscriptionId,
    });
  });
}

// ─── DELETE /api/push/subscribe ────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Anmeldung erforderlich');

    const body = await req.json().catch(() => null);
    const parsed = unsubscribeBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'endpoint ist erforderlich', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await pushNotificationService.unsubscribe(parsed.data.endpoint);

    if (!result.success) {
      return internalErrorResponse();
    }

    return NextResponse.json({ success: true });
  });
}

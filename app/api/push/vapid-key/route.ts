/**
 * GET /api/push/vapid-key — Returns the VAPID public key for client-side subscription
 */

import { NextResponse } from 'next/server';
import { pushNotificationService } from '@/lib/push-notification.service';

export async function GET() {
  const publicKey = pushNotificationService.getPublicKey();
  if (!publicKey) {
    return NextResponse.json({ error: 'Push notifications not configured' }, { status: 503 });
  }
  return NextResponse.json({ publicKey });
}

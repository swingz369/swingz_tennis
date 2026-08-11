/**
 * Push Notification Service
 *
 * Server-side service for managing Web Push subscriptions and sending
 * push notifications. Uses the web-push library with VAPID authentication.
 *
 * Environment variables required:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — VAPID public key (also used client-side)
 *   VAPID_PRIVATE_KEY             — VAPID private key (server-only)
 *   VAPID_SUBJECT                 — VAPID subject (mailto: or https:// URL)
 */

import webpush from 'web-push';
import { createServiceClient } from '@/lib/supabase/service';

import { createLogger } from '@/lib/logger';

const log = createLogger('push-notification.service');

// ─── VAPID Configuration ──────────────────────────────────────────────

let vapidConfigured = false;

function ensureVapidConfig() {
  if (vapidConfigured) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@swingz.de';

  if (!publicKey || !privateKey) {
    throw new Error(
      'VAPID keys not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.'
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

// ─── Types ────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  club_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  is_active: boolean;
}

// ─── Service ──────────────────────────────────────────────────────────

export class PushNotificationService {
  private static instance: PushNotificationService;

  private constructor() {}

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Get the VAPID public key for client-side subscription.
   */
  getPublicKey(): string | null {
    return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
  }

  /**
   * Subscribe a user to push notifications.
   * Upserts by endpoint (one subscription per device).
   */
  async subscribe(params: {
    userId: string;
    clubId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string;
  }): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
    try {
      const supabase = createServiceClient();

      // Check if endpoint already exists (re-subscribe after token refresh)
      const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('endpoint', params.endpoint)
        .maybeSingle();

      if (existing) {
        // Update existing subscription (keys may have changed)
        const { error } = await supabase
          .from('push_subscriptions')
          .update({
            user_id: params.userId,
            club_id: params.clubId,
            p256dh: params.p256dh,
            auth: params.auth,
            is_active: true,
            user_agent: params.userAgent || null,
          })
          .eq('id', existing.id);

        if (error) throw error;
        return { success: true, subscriptionId: existing.id };
      }

      // Insert new subscription
      const { data, error } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: params.userId,
          club_id: params.clubId,
          endpoint: params.endpoint,
          p256dh: params.p256dh,
          auth: params.auth,
          user_agent: params.userAgent || null,
          is_active: true,
        })
        .select('id')
        .single();

      if (error) throw error;
      return { success: true, subscriptionId: data.id };
    } catch (err) {
      log.error('[PushService] Subscribe error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Unsubscribe (deactivate) a push subscription by endpoint.
   */
  async unsubscribe(endpoint: string): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = createServiceClient();
      const { error } = await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('endpoint', endpoint);

      if (error) throw error;
      return { success: true };
    } catch (err) {
      log.error('[PushService] Unsubscribe error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Send a push notification to a specific user.
   * Sends to ALL active subscriptions for that user (multi-device support).
   */
  async sendToUser(
    userId: string,
    payload: PushPayload
  ): Promise<{
    success: boolean;
    sent: number;
    failed: number;
    cleanedUp: number;
  }> {
    ensureVapidConfig();

    const supabase = createServiceClient();
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!subscriptions || subscriptions.length === 0) {
      return { success: true, sent: 0, failed: 0, cleanedUp: 0 };
    }

    return this.sendToMany(subscriptions as PushSubscriptionRow[], payload);
  }

  /**
   * Send a push notification to all active users in a club.
   */
  async sendToClub(
    clubId: string,
    payload: PushPayload
  ): Promise<{
    success: boolean;
    sent: number;
    failed: number;
    cleanedUp: number;
  }> {
    ensureVapidConfig();

    const supabase = createServiceClient();
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('club_id', clubId)
      .eq('is_active', true);

    if (!subscriptions || subscriptions.length === 0) {
      return { success: true, sent: 0, failed: 0, cleanedUp: 0 };
    }

    return this.sendToMany(subscriptions as PushSubscriptionRow[], payload);
  }

  /**
   * Send push notifications to multiple subscriptions.
   * Handles cleanup of expired/invalid endpoints (HTTP 404/410).
   */
  private async sendToMany(
    subscriptions: PushSubscriptionRow[],
    payload: PushPayload
  ): Promise<{ success: boolean; sent: number; failed: number; cleanedUp: number }> {
    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.svg',
      badge: payload.badge || '/icons/icon-192x192.svg',
      url: payload.url || '/',
      tag: payload.tag,
      data: payload.data || {},
    });

    let sent = 0;
    let failed = 0;
    const staleEndpoints: string[] = [];

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            notificationPayload
          );
          sent++;
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          // 404 = Not Found, 410 = Gone — subscription is invalid
          if (statusCode === 404 || statusCode === 410) {
            staleEndpoints.push(sub.endpoint);
          }
          failed++;
          log.warn(`[PushService] Failed to send to ${sub.id}:`, statusCode || err);
        }
      })
    );

    // Cleanup stale subscriptions
    if (staleEndpoints.length > 0) {
      const supabase = createServiceClient();
      await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .in('endpoint', staleEndpoints);
    }

    return {
      success: failed === 0,
      sent,
      failed,
      cleanedUp: staleEndpoints.length,
    };
  }
}

export const pushNotificationService = PushNotificationService.getInstance();

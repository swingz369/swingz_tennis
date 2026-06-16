'use client';

import { useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/src/infrastructure/external/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Supabase Realtime hook for live notification and message updates.
 *
 * Replaces the 30-second polling interval in NotificationBell with
 * instant push via Postgres Changes on the `notifications` table.
 * Falls back to polling if Realtime is unavailable or connection drops.
 *
 * @param userId - Current user ID to filter notifications
 * @param onUpdate - Callback when a notification/message change is detected
 */
export function useNotificationsRealtime(userId: string | undefined, onUpdate: () => void) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const fallbackRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    if (fallbackRef.current) {
      clearInterval(fallbackRef.current);
      fallbackRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    // Subscribe to INSERT/UPDATE on notifications for this user
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          onUpdate();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Realtime connected — clear any fallback polling
          if (fallbackRef.current) {
            clearInterval(fallbackRef.current);
            fallbackRef.current = null;
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Fallback: start polling if Realtime fails
          if (!fallbackRef.current) {
            fallbackRef.current = setInterval(onUpdate, 30_000);
          }
        }
      });

    channelRef.current = channel;

    // Safety net: start a fallback poll that stops once Realtime connects
    // This covers the brief window between mount and SUBSCRIBED status
    const safetyPoll = setTimeout(() => {
      if (channelRef.current && !fallbackRef.current) {
        // If still not subscribed after 5s, enable fallback polling
        const state = channelRef.current.state;
        if (state !== 'joined') {
          fallbackRef.current = setInterval(onUpdate, 30_000);
        }
      }
    }, 5_000);

    return () => {
      clearTimeout(safetyPoll);
      cleanup();
    };
  }, [userId, onUpdate, cleanup]);
}

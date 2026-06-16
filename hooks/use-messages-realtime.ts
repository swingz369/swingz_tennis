'use client';

import { useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/src/infrastructure/external/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Supabase Realtime hook for live message updates.
 *
 * Subscribes to Postgres Changes on the `messages` table for the current
 * user (as receiver). Triggers `onNewMessage` when a new message arrives
 * or an existing message is updated (e.g., marked as read).
 *
 * Falls back to polling if Realtime is unavailable or connection drops.
 *
 * @param userId - Current user ID to filter messages by receiver_id
 * @param onNewMessage - Callback when a new/updated message is detected
 */
export function useMessagesRealtime(userId: string | undefined, onNewMessage: () => void) {
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

    // Subscribe to INSERT/UPDATE on messages where this user is the receiver
    const channel = supabase
      .channel(`messages:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userId}`,
        },
        () => {
          onNewMessage();
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
            fallbackRef.current = setInterval(onNewMessage, 30_000);
          }
        }
      });

    channelRef.current = channel;

    // Safety net: start a fallback poll that stops once Realtime connects
    const safetyPoll = setTimeout(() => {
      if (channelRef.current && !fallbackRef.current) {
        const state = channelRef.current.state;
        if (state !== 'joined') {
          fallbackRef.current = setInterval(onNewMessage, 30_000);
        }
      }
    }, 5_000);

    return () => {
      clearTimeout(safetyPoll);
      cleanup();
    };
  }, [userId, onNewMessage, cleanup]);
}

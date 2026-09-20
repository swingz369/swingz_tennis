'use client';

import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/src/infrastructure/external/supabase/client';

export interface ChatRealtimeMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  reply_to_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

export type ChatRealtimeEvent =
  | { type: 'message' | 'message_updated'; message: ChatRealtimeMessage }
  /** Verbindung war weg und ist zurück: Zustand neu laden, Nachrichten könnten fehlen. */
  | { type: 'resync' };

/**
 * Ein privater Broadcast-Kanal je Nutzer (`chat:<userId>`, gespeist vom DB-Trigger
 * `chat_after_message`). Seite und Glocke teilen sich denselben Kanal — supabase-js
 * erlaubt kein zweites `.on()` nach `subscribe()`, daher Singleton mit Listener-Menge.
 */
const listeners = new Set<(e: ChatRealtimeEvent) => void>();
let channel: RealtimeChannel | null = null;
let channelUser: string | null = null;

function emit(e: ChatRealtimeEvent) {
  listeners.forEach((l) => l(e));
}

function connect(userId: string) {
  if (channel && channelUser === userId) return;
  disconnect();
  const supabase = createClient();
  let subscribedBefore = false;
  const forward =
    (type: 'message' | 'message_updated') =>
    ({ payload }: { payload: { message: ChatRealtimeMessage } }) =>
      emit({ type, message: payload.message });
  channel = supabase
    .channel(`chat:${userId}`, { config: { private: true } })
    .on('broadcast', { event: 'message' }, forward('message'))
    .on('broadcast', { event: 'message_updated' }, forward('message_updated'))
    .subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      if (subscribedBefore) emit({ type: 'resync' });
      subscribedBefore = true;
    });
  channelUser = userId;
}

function disconnect() {
  if (!channel) return;
  createClient().removeChannel(channel);
  channel = null;
  channelUser = null;
}

export function useChatRealtime(
  userId: string | undefined,
  onEvent: (e: ChatRealtimeEvent) => void
) {
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });

  useEffect(() => {
    if (!userId) return;
    const listener = (e: ChatRealtimeEvent) => handler.current(e);
    listeners.add(listener);
    connect(userId);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) disconnect();
    };
  }, [userId]);
}

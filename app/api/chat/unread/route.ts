import type { NextRequest } from 'next/server';
import { chatRoute } from '../_route';

export const dynamic = 'force-dynamic';

/** GET /api/chat/unread — Summe ungelesener Nachrichten (Glocke). */
export async function GET(request: NextRequest) {
  return chatRoute(request, null, async (chat) => ({ count: await chat.unreadTotal() }));
}

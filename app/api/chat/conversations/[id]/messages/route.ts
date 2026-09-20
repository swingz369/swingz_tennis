import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { chatRoute } from '../../../_route';

export const dynamic = 'force-dynamic';

const sendSchema = z.object({
  body: z.string().trim().min(1, 'Nachricht fehlt').max(5000),
  replyToId: z.string().uuid().nullish(),
});

type Ctx = { params: Promise<{ id: string }> };

/** GET ?before=<created_at>&limit=<n> — ältere Nachrichten, aufsteigend sortiert. */
export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const sp = new URL(request.url).searchParams;
  const before = sp.get('before');
  const limit = Math.min(100, Math.max(1, Number(sp.get('limit')) || 40));
  return chatRoute(request, null, async (chat) => {
    const messages = await chat.listMessages(id, before, limit);
    return { messages, hasMore: messages.length === limit };
  });
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return chatRoute(
    request,
    sendSchema,
    async (chat, body) => ({
      message: await chat.sendMessage(id, body.body, body.replyToId ?? null),
    }),
    { status: 201 }
  );
}

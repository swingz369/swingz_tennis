import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { CHAT_REACTIONS } from '@/lib/chat-reactions';
import { chatRoute } from '../../../_route';

const reactSchema = z.object({ emoji: z.enum(CHAT_REACTIONS), on: z.boolean() });

type Ctx = { params: Promise<{ id: string }> };

/** POST { emoji, on } — eigene Reaktion setzen (on: true) oder zurücknehmen. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return chatRoute(request, reactSchema, (chat, b) => chat.react(id, b.emoji, b.on));
}

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { chatRoute, noClub } from '../_route';

export const dynamic = 'force-dynamic';

const createSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('direct'), userId: z.string().uuid() }),
  z.object({
    kind: z.literal('group'),
    title: z.string().trim().min(1, 'Titel fehlt').max(120),
    audience: z.enum(['custom', 'all', 'trainers']).default('custom'),
    userIds: z.array(z.string().uuid()).max(500).default([]),
  }),
]);

/** GET /api/chat/conversations — meine Unterhaltungen im aktiven Verein. */
export async function GET(request: NextRequest) {
  return chatRoute(request, null, async (chat, _b, auth) => ({
    conversations: await chat.listConversations(auth.clubId ?? null),
  }));
}

/** POST /api/chat/conversations — Direkt- oder Gruppenchat anlegen (bei Direkt: bestehenden liefern). */
export async function POST(request: NextRequest) {
  return chatRoute(
    request,
    createSchema,
    async (chat, body, auth) => {
      if (!auth.clubId) throw noClub();
      const id =
        body.kind === 'direct'
          ? await chat.startDirect(auth.clubId, body.userId)
          : await chat.createGroup(auth.clubId, body.title, body.audience, body.userIds);
      return { id };
    },
    { status: 201 }
  );
}

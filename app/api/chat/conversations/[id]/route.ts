import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { chatRoute } from '../../_route';

const patchSchema = z
  .object({ read: z.literal(true).optional(), muted: z.boolean().optional() })
  .refine((v) => v.read !== undefined || v.muted !== undefined, 'Keine Änderung angegeben');

type Ctx = { params: Promise<{ id: string }> };

/** PATCH — Lesemarke setzen und/oder stummschalten (nur eigene Teilnahme). */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return chatRoute(request, patchSchema, (chat, body) => chat.updateOwnState(id, body));
}

/** DELETE — Gruppe verlassen. */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return chatRoute(request, null, (chat) => chat.leave(id));
}

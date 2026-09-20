import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { chatRoute } from '../../_route';

const editSchema = z.object({ body: z.string().trim().min(1, 'Nachricht fehlt').max(5000) });

type Ctx = { params: Promise<{ id: string }> };

/** PATCH — eigene Nachricht bearbeiten. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return chatRoute(request, editSchema, async (chat, b) => ({
    message: await chat.editMessage(id, b.body),
  }));
}

/** DELETE — eigene Nachricht löschen (Löschmarke, Text wird geleert). */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return chatRoute(request, null, (chat) => chat.deleteMessage(id));
}

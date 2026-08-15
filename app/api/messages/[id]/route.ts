/**
 * app/api/messages/[id]/route.ts
 *
 * PATCH  — Nachricht archivieren / aus dem Archiv holen / als (un)gelesen markieren
 * DELETE — Nachricht aus der eigenen Sicht entfernen (Soft-Delete)
 *
 * Sicht-Zustände sind pro Person, nicht pro Zeile: Absender und Empfänger teilen
 * sich dieselbe Zeile (Ordner „Gesendet" liest über sender_id). Deshalb setzt
 * der Empfänger `archived_at`/`deleted_at`, der Absender `sender_deleted_at`
 * (Migration 20260815160000).
 *
 * Gelöscht wird weich: Vereinskommunikation ist im Streitfall Beleg — wer wann
 * welche Absage bekommen hat. Die Zeile bleibt, nur die Sicht ändert sich.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:messages:[id]');

export const dynamic = 'force-dynamic';

type Role = 'receiver' | 'sender';

/** Lädt die Nachricht und stellt fest, in welcher Rolle der Aufrufer sie sieht. */
async function loadOwnMessage(auth: any, id: string) {
  const { data } = await (auth.supabase as any)
    .from('messages')
    .select('id, sender_id, receiver_id')
    .eq('id', id)
    .maybeSingle();

  if (!data) return null;
  const roles: Role[] = [];
  if (data.receiver_id === auth.user.id) roles.push('receiver');
  if (data.sender_id === auth.user.id) roles.push('sender');
  return roles.length > 0 ? { message: data, roles } : null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'member'))) {
      return NextResponse.json({ error: 'Anmeldung erforderlich' }, { status: 403 });
    }

    const { id } = await params;
    const own = await loadOwnMessage(auth, id);
    if (!own) return NextResponse.json({ error: 'Nachricht nicht gefunden' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};

    // Archivieren und Lesestatus sind Empfänger-Zustände. Ein Absender, der
    // seine eigene Nachricht im Ordner „Gesendet" öffnet, ändert damit nichts.
    if (!own.roles.includes('receiver')) {
      return NextResponse.json(
        { error: 'Nur der Empfänger kann diese Nachricht ändern' },
        { status: 403 }
      );
    }

    if (typeof body.archived === 'boolean') {
      patch.archived_at = body.archived ? new Date().toISOString() : null;
    }
    if (typeof body.is_read === 'boolean') {
      patch.is_read = body.is_read;
      patch.read_at = body.is_read ? new Date().toISOString() : null;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Keine Änderung angegeben' }, { status: 400 });
    }

    const { error } = await (auth.supabase as any)
      .from('messages')
      .update(patch)
      .eq('id', id)
      .eq('receiver_id', auth.user.id);

    if (error) {
      log.error('Nachricht konnte nicht geändert werden', { id, error: error.message });
      return NextResponse.json({ error: 'Änderung fehlgeschlagen' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'member'))) {
      return NextResponse.json({ error: 'Anmeldung erforderlich' }, { status: 403 });
    }

    const { id } = await params;
    const own = await loadOwnMessage(auth, id);
    if (!own) return NextResponse.json({ error: 'Nachricht nicht gefunden' }, { status: 404 });

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {};
    // Wer die Nachricht an sich selbst geschickt hat, räumt beide Sichten ab.
    if (own.roles.includes('receiver')) patch.deleted_at = now;
    if (own.roles.includes('sender')) patch.sender_deleted_at = now;

    const { error } = await (auth.supabase as any).from('messages').update(patch).eq('id', id);

    if (error) {
      log.error('Nachricht konnte nicht gelöscht werden', { id, error: error.message });
      return NextResponse.json({ error: 'Löschen fehlgeschlagen' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}

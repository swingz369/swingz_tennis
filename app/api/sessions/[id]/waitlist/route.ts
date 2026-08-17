/**
 * GET    /api/sessions/[id]/waitlist  — Eigene Wartelisten-Position abrufen
 * POST   /api/sessions/[id]/waitlist  — Auf Warteliste setzen
 * DELETE /api/sessions/[id]/waitlist  — Von Warteliste entfernen
 *
 * Note: session_waitlist table types not yet in generated Supabase types —
 * using (supabase) casts until types are regenerated after migration.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:sessions:waitlist');

type WaitlistEntry = {
  id: string;
  session_id: string;
  member_id: string;
  club_id: string;
  position: number;
  created_at: string;
  notified_at: string | null;
};

// GET — Aktuelle Position auf Warteliste abrufen
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Authentifizierung erforderlich');

    const { id } = await params;
    const db = auth.supabase;

    const { data, error } = await db
      .from('session_waitlist')
      .select('id, position, created_at')
      .eq('session_id', id)
      .eq('member_id', auth.user.id)
      .maybeSingle();

    if (error) {
      log.error(
        'Waitlist-Position abrufen fehlgeschlagen',
        error instanceof Error ? error : undefined
      );
      return NextResponse.json({ error: 'Fehler beim Abrufen der Warteliste' }, { status: 500 });
    }

    return NextResponse.json({
      entry: (data as Pick<WaitlistEntry, 'id' | 'position' | 'created_at'> | null) ?? null,
    });
  });
}

// POST — Auf Warteliste setzen
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Authentifizierung erforderlich');

    const { id } = await params;
    const supabase = auth.supabase;
    const db = supabase;
    const body = await req.json().catch(() => ({}));
    const clubId = body.clubId as string | undefined;

    if (!clubId) {
      return NextResponse.json({ error: 'clubId erforderlich' }, { status: 400 });
    }

    // Prüfen ob Session existiert und voll ist
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, max_participants')
      .eq('id', id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session nicht gefunden' }, { status: 404 });
    }

    // Aktuelle Buchungsanzahl prüfen
    const { count: bookingCount } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', id)
      .in('status', ['confirmed', 'pending']);

    if ((bookingCount ?? 0) < session.max_participants) {
      return NextResponse.json(
        { error: 'Session hat noch freie Plätze. Bitte direkt buchen.' },
        { status: 409 }
      );
    }

    // Prüfen ob bereits auf Warteliste
    const { data: existing } = await db
      .from('session_waitlist')
      .select('id, position')
      .eq('session_id', id)
      .eq('member_id', auth.user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Du bist bereits auf der Warteliste', entry: existing },
        { status: 409 }
      );
    }

    // Aktuelle maximale Position ermitteln
    const { data: maxPos } = await db
      .from('session_waitlist')
      .select('position')
      .eq('session_id', id)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const position = ((maxPos as { position: number } | null)?.position ?? 0) + 1;

    const { data: entry, error: insertError } = await db
      .from('session_waitlist')
      .insert({
        session_id: id,
        member_id: auth.user.id,
        club_id: clubId,
        position,
      })
      .select('id, position, created_at')
      .single();

    if (insertError) {
      log.error(
        'Warteliste eintragen fehlgeschlagen',
        insertError instanceof Error ? insertError : undefined
      );
      return NextResponse.json(
        { error: 'Fehler beim Eintragen in die Warteliste' },
        { status: 500 }
      );
    }

    log.info('Mitglied auf Warteliste eingetragen', {
      id,
      memberId: auth.user.id,
      position,
    });

    return NextResponse.json({ success: true, entry }, { status: 201 });
  });
}

// DELETE — Von Warteliste entfernen
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) return forbiddenResponse('Authentifizierung erforderlich');

    const { id } = await params;
    const db = auth.supabase;

    // Eintrag prüfen
    const { data: entry, error: fetchError } = await db
      .from('session_waitlist')
      .select('id, position')
      .eq('session_id', id)
      .eq('member_id', auth.user.id)
      .maybeSingle();

    if (fetchError || !entry) {
      return NextResponse.json({ error: 'Kein Wartelisten-Eintrag gefunden' }, { status: 404 });
    }

    const typedEntry = entry as Pick<WaitlistEntry, 'id' | 'position'>;

    const { error: deleteError } = await db
      .from('session_waitlist')
      .delete()
      .eq('id', typedEntry.id);

    if (deleteError) {
      log.error(
        'Wartelisten-Eintrag löschen fehlgeschlagen',
        deleteError instanceof Error ? deleteError : undefined
      );
      return NextResponse.json(
        { error: 'Fehler beim Entfernen von der Warteliste' },
        { status: 500 }
      );
    }

    // Positionen der nachfolgenden Einträge anpassen
    const { data: remaining } = await db
      .from('session_waitlist')
      .select('id, position')
      .eq('session_id', id)
      .gt('position', typedEntry.position)
      .order('position', { ascending: true });

    for (const r of (remaining ?? []) as Array<Pick<WaitlistEntry, 'id' | 'position'>>) {
      await db
        .from('session_waitlist')
        .update({ position: r.position - 1 })
        .eq('id', r.id);
    }

    log.info('Mitglied von Warteliste entfernt', { id, memberId: auth.user.id });

    return NextResponse.json({ success: true });
  });
}

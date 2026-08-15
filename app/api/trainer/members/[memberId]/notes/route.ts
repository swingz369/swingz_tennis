/**
 * GET    /api/trainer/members/[memberId]/notes  — Eigene Notiz des Trainers abrufen
 * PUT    /api/trainer/members/[memberId]/notes  — Notiz erstellen oder aktualisieren (upsert)
 * DELETE /api/trainer/members/[memberId]/notes  — Notiz löschen
 *
 * Auth: trainer (nur eigene Notizen; Trainer muss im selben Club wie das Mitglied sein)
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import { logAudit } from '@/lib/audit';

const log = createLogger('api:trainer:members:notes');

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'trainer')))
      return forbiddenResponse('Trainer-Zugang erforderlich');

    const { memberId } = await params;
    const service = createServiceClient();

    // Trainer-Datensatz des eingeloggten Users ermitteln
    const { data: trainer } = await (service as any)
      .from('trainers')
      .select('id')
      .eq('user_id', auth.user.id)
      .single();

    if (!trainer) {
      return NextResponse.json({ error: 'Trainer-Profil nicht gefunden' }, { status: 404 });
    }

    // Club-Zugehörigkeit prüfen: Trainer und Mitglied müssen im selben Club sein
    const clubId = auth.clubId;
    if (!clubId) {
      return NextResponse.json({ error: 'Kein Club-Kontext' }, { status: 400 });
    }

    const { data: note, error } = await (service as any)
      .from('trainer_member_notes')
      .select('id, note, created_at, updated_at')
      .eq('trainer_id', trainer.id)
      .eq('member_id', memberId)
      .eq('club_id', clubId)
      .maybeSingle();

    if (error) {
      log.error('Notiz-Abfrage fehlgeschlagen', error instanceof Error ? error : undefined);
      return internalErrorResponse();
    }

    return NextResponse.json({ note: note ?? null });
  });
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'trainer')))
      return forbiddenResponse('Trainer-Zugang erforderlich');

    const { memberId } = await params;
    const body = (await req.json().catch(() => null)) as { note?: string } | null;
    const noteText = body?.note?.trim();

    if (!noteText) {
      return NextResponse.json({ error: 'Notiz darf nicht leer sein' }, { status: 400 });
    }
    if (noteText.length > 2000) {
      return NextResponse.json({ error: 'Notiz darf maximal 2000 Zeichen haben' }, { status: 400 });
    }

    const clubId = auth.clubId;
    if (!clubId) {
      return NextResponse.json({ error: 'Kein Club-Kontext' }, { status: 400 });
    }

    const service = createServiceClient();

    const { data: trainer } = await (service as any)
      .from('trainers')
      .select('id')
      .eq('user_id', auth.user.id)
      .single();

    if (!trainer) {
      return NextResponse.json({ error: 'Trainer-Profil nicht gefunden' }, { status: 404 });
    }

    // Sicherstellen, dass Trainer im Club aktiv ist
    const { data: trainerClub } = await (service as any)
      .from('trainer_club')
      .select('trainer_id')
      .eq('trainer_id', trainer.id)
      .eq('club_id', clubId)
      .maybeSingle();

    if (!trainerClub) {
      return forbiddenResponse('Trainer ist nicht Mitglied dieses Vereins');
    }

    // Sicherstellen, dass das Mitglied im selben Club ist
    const { data: memberClub } = await (service as any)
      .from('user_club_memberships')
      .select('id')
      .eq('user_id', memberId)
      .eq('club_id', clubId)
      .eq('is_active', true)
      .maybeSingle();

    // member_id in bookings/memberships bezieht sich auf user_id; versuche beides
    const { data: memberClubById } = memberClub
      ? { data: memberClub }
      : await (service as any)
          .from('user_club_memberships')
          .select('id')
          .eq('id', memberId)
          .eq('club_id', clubId)
          .eq('is_active', true)
          .maybeSingle();

    if (!memberClub && !memberClubById) {
      return NextResponse.json(
        { error: 'Mitglied nicht in diesem Verein gefunden' },
        { status: 404 }
      );
    }

    // Upsert
    const { data: upserted, error } = await (service as any)
      .from('trainer_member_notes')
      .upsert(
        {
          trainer_id: trainer.id,
          member_id: memberId,
          club_id: clubId,
          note: noteText,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'trainer_id,member_id' }
      )
      .select('id, note, created_at, updated_at')
      .single();

    if (error) {
      log.error('Notiz-Upsert fehlgeschlagen', error instanceof Error ? error : undefined);
      return internalErrorResponse();
    }

    log.info('Trainer-Notiz gespeichert', { trainerId: trainer.id, memberId, clubId });

    // Eine Trainer-Notiz ist eine Beurteilung einer Person durch eine andere.
    // Dass sie existiert und wer sie geschrieben hat, gehört ins Protokoll —
    // der Text selbst bewusst nicht, sonst stünde die Beurteilung doppelt in
    // der Datenbank und wäre auch für Admins ohne Notizzugriff lesbar.
    await logAudit({
      actorId: auth.user.id,
      action: 'update',
      resourceType: 'trainer_note',
      resourceId: upserted.id,
      clubId,
      details: { target_member_id: memberId, length: noteText.length },
      request: req,
    });

    return NextResponse.json({ note: upserted });
  });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  return withApiAuth(req, async (auth) => {
    if (!(await verifyRole(auth, 'trainer')))
      return forbiddenResponse('Trainer-Zugang erforderlich');

    const { memberId } = await params;
    const clubId = auth.clubId;
    if (!clubId) {
      return NextResponse.json({ error: 'Kein Club-Kontext' }, { status: 400 });
    }

    const service = createServiceClient();

    const { data: trainer } = await (service as any)
      .from('trainers')
      .select('id')
      .eq('user_id', auth.user.id)
      .single();

    if (!trainer) {
      return NextResponse.json({ error: 'Trainer-Profil nicht gefunden' }, { status: 404 });
    }

    const { error } = await (service as any)
      .from('trainer_member_notes')
      .delete()
      .eq('trainer_id', trainer.id)
      .eq('member_id', memberId)
      .eq('club_id', clubId);

    if (error) {
      log.error('Notiz-Löschen fehlgeschlagen', error instanceof Error ? error : undefined);
      return internalErrorResponse();
    }

    log.info('Trainer-Notiz gelöscht', { trainerId: trainer.id, memberId, clubId });

    await logAudit({
      actorId: auth.user.id,
      action: 'delete',
      resourceType: 'trainer_note',
      resourceId: memberId,
      clubId,
      details: { target_member_id: memberId },
      request: req,
    });

    return NextResponse.json({ success: true });
  });
}

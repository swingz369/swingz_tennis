/**
 * POST /api/admin/trial-training/[requestId]/convert-to-member
 *
 * Konvertiert eine Probetraining-Anfrage in eine echte Mitgliedschaft:
 *   1. Supabase Auth-User anlegen (oder vorhandenen finden)
 *   2. user_club_memberships Eintrag erstellen
 *   3. Trial-Anfrage als konvertiert markieren
 *
 * Auth: Admin-only
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:admin:trial-training:convert-to-member');

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  return withApiAuth(req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) return forbiddenResponse('Admin-Zugriff erforderlich');

    const { requestId } = await params;

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
    }

    const { email, fullName, clubId } = body as {
      email?: string;
      fullName?: string;
      clubId?: string;
    };

    if (!email || !fullName || !clubId) {
      return NextResponse.json(
        { error: 'email, fullName und clubId sind erforderlich' },
        { status: 400 }
      );
    }

    // Service-Client für auth.admin und direkte DB-Operationen (bypasses RLS)
    const serviceClient = createServiceClient();

    // Probetraining-Anfrage abrufen
    const { data: trial, error: trialError } = await serviceClient
      .from('trial_trainings')
      .select(
        'id, club_id, participant_email, participant_first_name, participant_last_name, converted_to_member_id'
      )
      .eq('id', requestId)
      .maybeSingle();

    if (trialError || !trial) {
      return NextResponse.json({ error: 'Probetraining-Anfrage nicht gefunden' }, { status: 404 });
    }

    if (trial.converted_to_member_id) {
      return NextResponse.json(
        { error: 'Diese Probetraining-Anfrage wurde bereits konvertiert' },
        { status: 409 }
      );
    }

    // Sicherheitscheck: Admin darf nur seinen eigenen Verein konvertieren
    if (trial.club_id !== clubId) {
      return forbiddenResponse('Keine Berechtigung für diesen Verein');
    }

    // Prüfen ob bereits ein User mit dieser E-Mail existiert
    const { data: existingUsers } = await serviceClient
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .limit(1);

    let userId: string;

    if (existingUsers && existingUsers.length > 0) {
      // Bestehenden User verwenden
      userId = existingUsers[0].id;
      log.info('Bestehenden User gefunden', { userId, email });
    } else {
      // Neuen Supabase Auth-User anlegen
      const { data: newAuthUser, error: createError } = await serviceClient.auth.admin.createUser({
        email: email.toLowerCase(),
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
        },
      });

      if (createError || !newAuthUser.user) {
        log.error(
          'Auth-User anlegen fehlgeschlagen',
          createError instanceof Error ? createError : undefined
        );
        return NextResponse.json(
          {
            error: `Benutzer konnte nicht angelegt werden: ${createError?.message ?? 'Unbekannter Fehler'}`,
          },
          { status: 500 }
        );
      }

      userId = newAuthUser.user.id;

      // users-Tabelle befüllen (Profil anlegen)
      await serviceClient.from('users').upsert(
        {
          id: userId,
          email: email.toLowerCase(),
          full_name: fullName,
        },
        { onConflict: 'id' }
      );

      log.info('Neuer Auth-User angelegt', { userId, email });
    }

    // Prüfen ob Mitgliedschaft bereits existiert
    const { data: existingMembership } = await serviceClient
      .from('user_club_memberships')
      .select('id, is_active')
      .eq('user_id', userId)
      .eq('club_id', clubId)
      .maybeSingle();

    if (existingMembership) {
      if (!existingMembership.is_active) {
        // Reaktivieren
        await serviceClient
          .from('user_club_memberships')
          .update({ is_active: true, role: 'member' })
          .eq('id', existingMembership.id);
        log.info('Mitgliedschaft reaktiviert', { userId, clubId });
      } else {
        log.info('Mitgliedschaft bereits aktiv', { userId, clubId });
      }
    } else {
      // Neue Mitgliedschaft anlegen
      const { error: membershipError } = await serviceClient.from('user_club_memberships').insert({
        user_id: userId,
        club_id: clubId,
        role: 'member',
        is_active: true,
      });

      if (membershipError) {
        log.error(
          'Mitgliedschaft anlegen fehlgeschlagen',
          membershipError instanceof Error ? membershipError : undefined
        );
        return NextResponse.json(
          { error: 'Mitgliedschaft konnte nicht angelegt werden' },
          { status: 500 }
        );
      }
      log.info('Mitgliedschaft angelegt', { userId, clubId });
    }

    // Trial-Anfrage als konvertiert markieren
    const { error: updateError } = await serviceClient
      .from('trial_trainings')
      .update({
        converted_to_member_id: userId,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      log.error(
        'Trial-Update fehlgeschlagen',
        updateError instanceof Error ? updateError : undefined
      );
      // Non-fatal: User und Membership wurden bereits angelegt
    }

    // Willkommens-Benachrichtigung (in-app)
    try {
      await serviceClient.from('notifications').insert({
        user_id: userId,
        club_id: clubId,
        type: 'membership_created',
        title: 'Willkommen im Verein!',
        message: `Herzlich willkommen! Du bist jetzt offizielles Mitglied. Deine Zugangsdaten wurden per E-Mail zugesendet.`,
        read: false,
      });
    } catch (notifErr) {
      log.error(
        'Benachrichtigung senden fehlgeschlagen',
        notifErr instanceof Error ? notifErr : undefined
      );
    }

    log.info('Probetraining erfolgreich konvertiert', { requestId, userId, clubId });

    return NextResponse.json({
      success: true,
      userId,
      message: 'Mitgliedschaft erfolgreich angelegt',
    });
  });
}

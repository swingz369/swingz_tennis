import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:public:trial-training:signup');

const signupSchema = z.object({
  participantId: z.string().uuid('Ungültige Teilnehmer-ID'),
  password: z.string().min(8, 'Das Passwort muss mindestens 8 Zeichen lang sein'),
});

/**
 * Self-Service-Anmeldung nach dem Probetraining. Der Link kommt aus den
 * Follow-up-Mails (`lib/trial-training/followup.ts`) und trägt die
 * undurchsichtige `participant_id`. Die Person legt selbst ein Passwort fest
 * und wird damit Mitglied — kein Admin-Klick nötig.
 */
export async function POST(request: NextRequest) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
  if (rateLimitError) return rateLimitError;

  const body = await request.json().catch(() => null);
  const validation = signupSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? 'Ungültige Eingabe' },
      { status: 400 }
    );
  }

  const { participantId, password } = validation.data;

  try {
    const svc = createServiceClient();

    const { data: trial, error: trialError } = await svc
      .from('trial_trainings')
      .select(
        'id, club_id, participant_email, participant_first_name, participant_last_name, converted_to_member_id, status'
      )
      .eq('participant_id', participantId)
      .maybeSingle();

    if (trialError || !trial) {
      return NextResponse.json({ error: 'Probetraining nicht gefunden' }, { status: 404 });
    }
    if (trial.converted_to_member_id) {
      return NextResponse.json({ error: 'Du bist bereits Mitglied' }, { status: 409 });
    }
    if (trial.status !== 'completed') {
      return NextResponse.json(
        { error: 'Die Anmeldung ist erst nach einem abgeschlossenen Probetraining möglich' },
        { status: 400 }
      );
    }

    const email = trial.participant_email.toLowerCase();
    const fullName = `${trial.participant_first_name} ${trial.participant_last_name}`;

    // Bestehenden User nutzen oder neuen Auth-Account mit Passwort anlegen.
    const { data: existingUsers } = await svc
      .from('users')
      .select('id')
      .eq('email', email)
      .limit(1);
    let userId: string;

    if (existingUsers && existingUsers.length > 0) {
      userId = existingUsers[0].id;
    } else {
      const { data: newUser, error: createError } = await svc.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (createError || !newUser.user) {
        log.error('Self-serve auth user creation failed', createError);
        return NextResponse.json(
          { error: 'Account konnte nicht angelegt werden. Versuche es erneut.' },
          { status: 500 }
        );
      }
      userId = newUser.user.id;
      await svc
        .from('users')
        .upsert({ id: userId, email, full_name: fullName }, { onConflict: 'id' });
    }

    // Mitgliedschaft anlegen bzw. reaktivieren.
    const { data: existingMembership } = await svc
      .from('user_club_memberships')
      .select('id, is_active')
      .eq('user_id', userId)
      .eq('club_id', trial.club_id)
      .maybeSingle();

    if (existingMembership) {
      if (!existingMembership.is_active) {
        await svc
          .from('user_club_memberships')
          .update({ is_active: true, role: 'member' })
          .eq('id', existingMembership.id);
      }
    } else {
      const { error: membershipError } = await svc.from('user_club_memberships').insert({
        user_id: userId,
        club_id: trial.club_id,
        role: 'member',
        is_active: true,
      });
      if (membershipError) {
        log.error('Self-serve membership creation failed', membershipError);
        return NextResponse.json(
          { error: 'Mitgliedschaft konnte nicht angelegt werden' },
          { status: 500 }
        );
      }
    }

    // Probetraining als konvertiert markieren.
    const { error: updateError } = await svc
      .from('trial_trainings')
      .update({
        converted_to_member_id: userId,
        status: 'converted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', trial.id);

    if (updateError) {
      log.error('Self-serve trial update failed', updateError);
      // Non-fatal: User und Mitgliedschaft sind bereits angelegt.
    }

    // Willkommens-Benachrichtigung (fire-and-forget).
    try {
      await svc.from('notifications').insert({
        user_id: userId,
        club_id: trial.club_id,
        type: 'membership_created',
        title: 'Willkommen im Verein!',
        message: 'Herzlich willkommen! Du bist jetzt offizielles Mitglied.',
        read: false,
      });
    } catch (notifErr) {
      log.warn('Self-serve welcome notification failed', notifErr);
    }

    return NextResponse.json({ success: true, message: 'Willkommen im Verein!' });
  } catch (error) {
    log.error('Self-serve signup error', error instanceof Error ? error : undefined);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}

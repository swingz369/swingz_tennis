import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';

const log = createLogger('api:auth:join');

export async function POST(req: NextRequest) {
  const rateLimitError = await checkRateLimitOrFail(req, RATE_LIMITS.STRICT);
  if (rateLimitError) return rateLimitError;

  const body = await req.json().catch(() => ({}));
  const { email, password, fullName, clubId } = body;

  if (!email || !password || !clubId) {
    return NextResponse.json(
      { error: 'E-Mail, Passwort und Verein sind erforderlich' },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Passwort muss mindestens 8 Zeichen lang sein' },
      { status: 400 }
    );
  }

  const sb = createServiceClient();

  const { data: club } = await sb
    .from('clubs')
    .select('id, name, status')
    .eq('id', clubId)
    .eq('status', 'active')
    .maybeSingle();

  if (!club) {
    return NextResponse.json({ error: 'Verein nicht gefunden oder nicht aktiv' }, { status: 404 });
  }

  const { data: authData, error: authError } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName || email.split('@')[0] },
  });

  if (authError) {
    if (authError.message.toLowerCase().includes('already')) {
      return NextResponse.json(
        { error: 'Diese E-Mail-Adresse ist bereits registriert' },
        { status: 409 }
      );
    }
    log.error('Auth user creation failed', authError);
    return NextResponse.json({ error: 'Registrierung fehlgeschlagen' }, { status: 500 });
  }

  const userId = authData.user.id;

  await sb
    .from('users')
    .upsert(
      { id: userId, email, full_name: fullName || email.split('@')[0] },
      { onConflict: 'id' }
    );

  const { error: memberErr } = await sb.from('user_club_memberships').insert({
    user_id: userId,
    club_id: clubId,
    role: 'member',
    is_active: false,
  });

  if (memberErr) {
    log.error('Membership creation failed', memberErr);
    await sb.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: 'Mitgliedschaft konnte nicht erstellt werden' },
      { status: 500 }
    );
  }

  log.info('New member registered pending approval', { email, clubId });
  return NextResponse.json({
    success: true,
    message: `Registrierung bei ${club.name} erfolgreich. Dein Zugang wird vom Admin freigeschaltet.`,
  });
}

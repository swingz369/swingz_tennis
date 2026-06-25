import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { createLogger } from '@/lib/logger';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';

const log = createLogger('api:public:register');

export async function POST(request: NextRequest) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
  if (rateLimitError) return rateLimitError;

  try {
    const supabase = await createClient();
    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      street,
      city,
      postalCode,
      playingLevel,
      previousClub,
      motivation,
      wantsTrialTraining,
      clubId,
    } = body;

    // Validate required fields
    if (!firstName?.trim() || !lastName?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: 'Vorname, Nachname und E-Mail sind erforderlich' },
        { status: 400 }
      );
    }

    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Gültige E-Mail-Adresse erforderlich' }, { status: 400 });
    }

    // Check for existing registration
    const { data: existing } = await (supabase as any)
      .from('registration_requests')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Eine Registrierung mit dieser E-Mail liegt bereits vor' },
        { status: 409 }
      );
    }

    // Check for existing user
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { error: 'Ein Account mit dieser E-Mail existiert bereits' },
        { status: 409 }
      );
    }

    // Insert registration request
    const { error: insertError } = await (supabase as any).from('registration_requests').insert({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      street: street?.trim() || null,
      city: city?.trim() || null,
      postal_code: postalCode?.trim() || null,
      playing_level: playingLevel || 'intermediate',
      previous_club: previousClub?.trim() || null,
      motivation: motivation?.trim() || null,
      wants_trial_training: wantsTrialTraining ?? true,
      club_id: clubId || null,
      status: 'pending',
    });

    if (insertError) {
      log.error('Registration insert error:', insertError);
      return NextResponse.json(
        { error: 'Fehler beim Speichern der Registrierung' },
        { status: 500 }
      );
    }

    // Send notification email to swingz.cloud (non-blocking)
    if (env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(env.RESEND_API_KEY);

        await resend.emails.send({
          from: env.EMAIL_FROM || 'SwingZ <noreply@swingz.cloud>',
          to: 'info@swingz.cloud',
          subject: `📋 Neue Registrierung von ${firstName} ${lastName}`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <div style="background:#1B4332;color:white;padding:24px;border-radius:12px 12px 0 0">
                <h1 style="margin:0;font-size:20px">📋 Neue Registrierung</h1>
              </div>
              <div style="background:#f9f9f9;padding:24px;border-radius:0 0 12px 12px">
                <table style="width:100%;border-collapse:collapse">
                  <tr><td style="padding:8px 0;font-weight:600;width:140px">Name</td><td>${firstName} ${lastName}</td></tr>
                  <tr><td style="padding:8px 0;font-weight:600">E-Mail</td><td><a href="mailto:${email}">${email}</a></td></tr>
                  <tr><td style="padding:8px 0;font-weight:600">Telefon</td><td>${phone || '—'}</td></tr>
                  <tr><td style="padding:8px 0;font-weight:600">Stadt</td><td>${city || '—'}</td></tr>
                  <tr><td style="padding:8px 0;font-weight:600">Spielstärke</td><td>${playingLevel || 'intermediate'}</td></tr>
                  <tr><td style="padding:8px 0;font-weight:600">Probetraining</td><td>${wantsTrialTraining ? 'Ja' : 'Nein'}</td></tr>
                  <tr><td style="padding:8px 0;font-weight:600">Motivation</td><td>${motivation || '—'}</td></tr>
                </table>
                <p style="margin-top:16px;font-size:12px;color:#666">
                  Eingegangen: ${new Date().toLocaleString('de-DE')}
                </p>
              </div>
            </div>
          `,
          text: `Neue Registrierung\n\nName: ${firstName} ${lastName}\nE-Mail: ${email}\nTelefon: ${phone || '—'}\nStadt: ${city || '—'}\nSpielstärke: ${playingLevel || 'intermediate'}\nProbetraining: ${wantsTrialTraining ? 'Ja' : 'Nein'}\nMotivation: ${motivation || '—'}`,
        });
      } catch (emailError) {
        // Non-blocking — log but don't fail the request
        log.warn('[Register] Email notification failed:', emailError);
      }
    }

    return NextResponse.json(
      { success: true, message: 'Registrierung erfolgreich eingereicht' },
      { status: 201 }
    );
  } catch (error) {
    log.error('Registration error:', error);
    return NextResponse.json({ error: 'Interner Serverfehler' }, { status: 500 });
  }
}

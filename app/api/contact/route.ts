import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { env } from '@/lib/env';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:contact');

// Feld-Längen deckeln, bevor Daten in DB oder E-Mail landen. Die
// contact_requests-Spalten sind TEXT ohne DB-Limit — diese Obergrenzen sind
// die API-seitige Defense-in-Depth (zusätzlich zum STRICT-Rate-Limit oben).
const MAX_LENGTHS = {
  firstName: 100,
  lastName: 100,
  email: 254, // RFC 5321 Maximal-Länge
  clubName: 200,
  message: 5000,
} as const;

// HTML-Injection im internen Benachrichtigungs-Mail verhindern: alle
// Nutzereingaben werden vor der Interpolation in das HTML-Template escapet.
// Die `text:`-Variante bleibt unescapet — sie wird nicht als HTML gerendert.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(request: NextRequest) {
  const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
  if (rateLimitError) return rateLimitError;

  try {
    const body = await request.json();
    const { firstName, lastName, email, clubName, message } = body as {
      firstName?: string;
      lastName?: string;
      email?: string;
      clubName?: string;
      message?: string;
    };

    // Validate required fields
    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Bitte fülle alle Pflichtfelder aus.' }, { status: 400 });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Bitte gib eine gültige E-Mail-Adresse ein.' },
        { status: 400 }
      );
    }

    // Max-Längen deckeln
    const tooLong = (
      [
        { field: 'firstName', value: firstName, max: MAX_LENGTHS.firstName },
        { field: 'lastName', value: lastName, max: MAX_LENGTHS.lastName },
        { field: 'email', value: email, max: MAX_LENGTHS.email },
        { field: 'clubName', value: clubName, max: MAX_LENGTHS.clubName },
        { field: 'message', value: message, max: MAX_LENGTHS.message },
      ] as const
    ).find((f) => (f.value ?? '').length > f.max);
    if (tooLong) {
      return NextResponse.json(
        { error: `Das Feld „${tooLong.field}" ist zu lang (max. ${tooLong.max} Zeichen).` },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Insert into contact_requests table
    const { data: contactRequest, error: insertError } = await supabase
      .from('contact_requests')
      .insert({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        club_name: clubName?.trim() || null,
        message: message.trim(),
      })
      .select('id')
      .single();

    if (insertError) {
      log.error('[Contact] Insert error:', insertError);
      return NextResponse.json(
        { error: 'Speichern fehlgeschlagen. Bitte versuche es erneut.' },
        { status: 500 }
      );
    }

    // Send notification email via Resend (non-blocking)
    if (env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(env.RESEND_API_KEY);

        // Nutzereingaben vor der HTML-Interpolation escapen — der `text:`-
        // Fallback bleibt Klartext und wird nicht escapet.
        const safeFirstName = escapeHtml(firstName.trim());
        const safeLastName = escapeHtml(lastName.trim());
        const safeEmail = escapeHtml(email.trim().toLowerCase());
        const safeClubName = escapeHtml(clubName?.trim() || '—');
        const safeMessage = escapeHtml(message.trim());

        await resend.emails.send({
          from: env.EMAIL_FROM || 'SwingZ <noreply@swingz.cloud>',
          to: 'info@swingz.cloud',
          subject: `🎾 Neue Kontaktanfrage von ${firstName} ${lastName}`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <div style="background:#1B4332;color:white;padding:24px;border-radius:12px 12px 0 0">
                <h1 style="margin:0;font-size:20px">🎾 Neue Kontaktanfrage</h1>
              </div>
              <div style="background:#f9f9f9;padding:24px;border-radius:0 0 12px 12px">
                <table style="width:100%;border-collapse:collapse">
                  <tr><td style="padding:8px 0;font-weight:600;width:120px">Name</td><td>${safeFirstName} ${safeLastName}</td></tr>
                  <tr><td style="padding:8px 0;font-weight:600">E-Mail</td><td><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
                  <tr><td style="padding:8px 0;font-weight:600">Verein</td><td>${safeClubName}</td></tr>
                  <tr><td style="padding:8px 0;font-weight:600">Nachricht</td><td>${safeMessage}</td></tr>
                </table>
                <p style="margin-top:16px;font-size:12px;color:#666">
                  ID: ${contactRequest?.id} · Eingegangen: ${new Date().toLocaleString('de-DE')}
                </p>
              </div>
            </div>
          `,
          text: `Neue Kontaktanfrage\n\nName: ${firstName} ${lastName}\nE-Mail: ${email}\nVerein: ${clubName || '—'}\nNachricht: ${message}\n\nID: ${contactRequest?.id}`,
        });
      } catch (emailError) {
        // Non-blocking — log but don't fail the request
        log.warn('[Contact] Email notification failed:', emailError);
      }
    }

    return NextResponse.json({ success: true, id: contactRequest?.id }, { status: 201 });
  } catch (error) {
    log.error('[Contact] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Ein unerwarteter Fehler ist aufgetreten.' },
      { status: 500 }
    );
  }
}

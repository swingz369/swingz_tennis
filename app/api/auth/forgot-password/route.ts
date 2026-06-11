/**
 * POST /api/auth/forgot-password
 *
 * Accepts { email } and sends a password-reset email via Supabase recovery link.
 *
 * **Email-enumeration protection:**  This endpoint ALWAYS returns HTTP 200
 * with the same JSON body regardless of whether the email exists in the
 * database.  An attacker cannot distinguish between a valid and an invalid
 * address based on the response.
 *
 * Rate-limited to 5 requests per 15 minutes per IP (strict tier) to prevent
 * abuse.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';
import { sendPasswordResetEmail } from '@/lib/auth/send-password-reset-email';
import { env } from '@/lib/env';

// ─── Validation ──────────────────────────────────────────────────────────────

const bodySchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
});

// ─── Standard success response (always returned) ────────────────────────────

const SUCCESS_RESPONSE = NextResponse.json({
  message:
    'Falls ein Konto mit dieser E-Mail-Adresse existiert, haben wir dir einen Link zum Zurücksetzen des Passworts gesendet.',
});

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Rate limiting (strict: 5 req / 15 min per IP)
  const rateLimitError = await checkRateLimitOrFail(request, 'strict');
  if (rateLimitError) return rateLimitError;

  // 2. Parse & validate body
  let email: string;
  try {
    const raw = await request.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Ungültige E-Mail-Adresse' }, { status: 400 });
    }
    email = parsed.data.email.toLowerCase().trim();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
  }

  // 3. Always return the same success response (email-enumeration protection).
  //    We do the actual work *after* catching any early-return errors above,
  //    but we NEVER let Supabase lookup failures leak back to the caller.

  try {
    const supabase = createServiceClient();

    // Use Supabase Admin API to generate a recovery (password-reset) link.
    // generateLink works even if the email does not exist — it simply won't
    // send anything via Supabase's built-in email.  We use our own Resend
    // delivery so the link is what matters.
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      // The URL the user lands on after clicking the reset link.
      // /reset-password handles both PKCE (?code=) and implicit (#access_token=) flows.
      options: {
        redirectTo: `${env.NEXT_PUBLIC_APP_URL || 'https://swingz.app'}/reset-password`,
      },
    });

    if (error) {
      // Log but do NOT expose to client — still return 200.
      console.warn('[forgot-password] Supabase generateLink error (non-fatal):', error.message);
      return SUCCESS_RESPONSE;
    }

    // The properties.action_link contains the full reset URL with token.
    const resetUrl = data?.properties?.action_link;
    if (resetUrl) {
      await sendPasswordResetEmail({ to: email, resetUrl });
    } else {
      console.warn('[forgot-password] generateLink returned no action_link — email skipped');
    }
  } catch (err) {
    // Catch-all: log but never expose.
    console.error('[forgot-password] Unexpected error:', err);
  }

  // 4. Always return 200 — indistinguishable whether the account exists.
  return SUCCESS_RESPONSE;
}

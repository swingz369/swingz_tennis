import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';

// GET /auth/callback – Supabase Auth callback handler
//
// Handles multiple auth flows:
// - signup / magiclink / oauth: exchanges code → session, redirects to redirect_to or /
// - recovery (password-reset): does NOT exchange the code server-side — the
//   /reset-password page exchanges it client-side so it can show the new-password
//   form in the same page load.  We forward the code to /reset-password instead.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const type = searchParams.get('type');

  // ── Recovery flow → forward to /reset-password with the code ────────────
  // The client-side page will call exchangeCodeForSession(code) itself so it
  // can show the new-password form in the same render.
  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/reset-password?code=${encodeURIComponent(code)}`);
  }

  // ── Standard flows (signup, magiclink, oauth, invite) ───────────────────
  const supabase = await createClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Auth callback error:', error);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  // Redirect to home or stored redirect URL
  const redirectTo = searchParams.get('redirect_to') || '/';
  return NextResponse.redirect(`${origin}${redirectTo}`);
}

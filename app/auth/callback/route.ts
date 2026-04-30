import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';

// GET /auth/callback – Supabase Auth callback handler
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

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

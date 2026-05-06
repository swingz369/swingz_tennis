import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url), { status: 302 });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({ name, value, ...options });
          });
        },
      },
    }
  );

  await supabase.auth.signOut();

  // Clear admin club cookie
  response.cookies.set('admin_club_id', '', { maxAge: 0, path: '/' });
  response.cookies.set('selected-club-id', '', { maxAge: 0, path: '/' });

  return response;
}

// Also support GET for form-based logout
export async function GET(request: NextRequest) {
  return POST(request);
}

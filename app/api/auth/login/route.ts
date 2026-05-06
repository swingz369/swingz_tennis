import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // SECURITY FIX: Add strict rate limiting to prevent brute force attacks
    // Limit: 5 login attempts per 15 minutes per IP
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.AUTH);
    if (rateLimitError) {
      return rateLimitError;
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Create response that we can modify (for setting cookies)
    const response = NextResponse.json({ success: true });

    // Create Supabase client with tsowapp-style cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                response.cookies.set({
                  name,
                  value,
                  ...options,
                  httpOnly: options?.httpOnly ?? true,
                  secure: options?.secure ?? process.env.NODE_ENV === 'production',
                  sameSite: (options?.sameSite as 'lax' | 'strict' | 'none') ?? 'lax',
                });
              });
            } catch (error) {
              console.error('Cookie setting error:', error);
            }
          },
        },
      }
    );

    // Sign in with password
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Login error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (!data.session) {
      return NextResponse.json({ error: 'No session created' }, { status: 500 });
    }

    console.log('✅ Login successful:', {
      userId: data.user.id,
      email: data.user.email,
      expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
    });

    return response;
  } catch (error) {
    console.error('Unexpected login error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Login failed' },
      { status: 500 }
    );
  }
}

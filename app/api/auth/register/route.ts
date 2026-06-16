import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceClient } from '@/lib/supabase/service';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('auth:register');

export async function POST(request: NextRequest) {
  try {
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.AUTH);
    if (rateLimitError) {
      return rateLimitError;
    }

    const { email, password, full_name, club_name, club_city } = await request.json();

    if (!email || !password || !full_name) {
      return NextResponse.json(
        { error: 'E-Mail, Passwort und Name sind erforderlich' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Passwort muss mindestens 8 Zeichen lang sein' },
        { status: 400 }
      );
    }

    if (!club_name || !club_name.trim()) {
      return NextResponse.json({ error: 'Vereinsname ist erforderlich' }, { status: 400 });
    }

    // Create response for cookie handling
    const response = NextResponse.json({ success: true });

    // Create Supabase client with cookie handling (same pattern as login)
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
              log.error('Cookie setting error:', error);
            }
          },
        },
      }
    );

    // Sign up the user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
        },
      },
    });

    if (authError) {
      log.error('Registration auth error', authError);
      // Map common Supabase errors to German messages
      const msg = authError.message;
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        return NextResponse.json(
          { error: 'Diese E-Mail ist bereits registriert. Bitte melde dich an.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Benutzer konnte nicht erstellt werden' }, { status: 500 });
    }

    const userId = authData.user.id;

    // Use service client for admin operations (club + membership creation)
    const serviceSb = createServiceClient();

    // Create the club
    const { data: club, error: clubError } = await serviceSb
      .from('clubs')
      .insert({
        name: club_name.trim(),
        city: club_city?.trim() || null,
        status: 'active',
      })
      .select('id')
      .single();

    if (clubError || !club) {
      log.error('Club creation failed', clubError ?? undefined);
      return NextResponse.json({ error: 'Verein konnte nicht erstellt werden' }, { status: 500 });
    }

    // Create user record if it doesn't exist yet
    const { error: userError } = await serviceSb
      .from('users')
      .upsert({ id: userId, email, full_name }, { onConflict: 'id' });

    if (userError) {
      log.error('User record upsert failed', userError);
    }

    // Create admin membership
    const { error: membershipError } = await serviceSb.from('user_club_memberships').insert({
      user_id: userId,
      club_id: club.id,
      role: 'admin',
      is_active: true,
    });

    if (membershipError) {
      log.error('Membership creation failed', membershipError);
      return NextResponse.json(
        { error: 'Mitgliedschaft konnte nicht erstellt werden' },
        { status: 500 }
      );
    }

    log.info('Registration successful', {
      userId,
      clubId: club.id,
      clubName: club_name.trim(),
    });

    return response;
  } catch (error) {
    log.error('Unexpected registration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Registrierung fehlgeschlagen' },
      { status: 500 }
    );
  }
}

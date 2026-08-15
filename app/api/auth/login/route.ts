import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { errorResponse, internalErrorResponse } from '@/lib/api-error';
import { createServerClient } from '@supabase/ssr';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { logAudit } from '@/lib/audit';
import { createServiceClient } from '@/lib/supabase/service';

const log = createLogger('auth:login');

/**
 * Fehlgeschlagene Anmeldungen protokollieren.
 *
 * `audit_logs.actor_id` ist FK auf `users.id` — bei einem Fehlversuch haben wir
 * keine Session, also muss die ID über die E-Mail nachgeschlagen werden. Für
 * eine unbekannte E-Mail gibt es niemanden, dem der Versuch zuzuordnen wäre;
 * der Eintrag entfällt dann. (Die Anzahl der Versuche pro IP begrenzt bereits
 * das Rate-Limit oben — hier geht es um die Zuordnung zum Konto, nicht um die
 * Abwehr.)
 */
async function logFailedLogin(email: string, request: NextRequest, reason: string) {
  try {
    const { data } = await createServiceClient()
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (!data?.id) return;
    await logAudit({
      actorId: data.id,
      action: 'login_failed',
      resourceType: 'user',
      resourceId: data.id,
      details: { email, reason },
      request,
    });
  } catch (err) {
    log.error(
      'login_failed konnte nicht protokolliert werden',
      err instanceof Error ? err : undefined
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.AUTH);
    if (rateLimitError) {
      return rateLimitError;
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'E-Mail und Passwort erforderlich' }, { status: 400 });
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
              log.error('Cookie setting error:', error);
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
      log.error('Login error:', error.message);
      await logFailedLogin(email, request, error.message);
      return errorResponse('UNAUTHORIZED', 'E-Mail oder Passwort ist falsch');
    }

    if (!data.session) {
      return NextResponse.json({ error: 'Keine Session erstellt' }, { status: 500 });
    }

    log.info('Login successful', {
      userId: data.user.id,
      email: data.user.email,
    });

    // Anmeldungen waren bislang nirgends protokolliert — ohne sie lässt sich
    // einem Zugriff im Protokoll keine Sitzung zuordnen.
    await logAudit({
      actorId: data.user.id,
      action: 'login',
      resourceType: 'user',
      resourceId: data.user.id,
      details: { email: data.user.email },
      request,
    });

    return response;
  } catch (error) {
    log.error('Unexpected login error:', error);
    return internalErrorResponse();
  }
}

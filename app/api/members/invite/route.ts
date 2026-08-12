import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';
import { appBaseUrl } from '@/lib/app-url';

const log = createLogger('api:members:invite');

const InviteSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  full_name: z.string().min(2, 'Name muss mindestens 2 Zeichen haben').optional(),
  role: z.enum(['member', 'trainer', 'admin']).default('member'),
  club_id: z.string().uuid('Ungültige Club-ID').optional(),
});

/**
 * POST /api/members/invite
 * Admin lädt ein neues Mitglied per E-Mail ein.
 * Nutzt Supabase Admin API (service role) um eine Invite-Email zu senden.
 */
export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    // Only admin and superadmin can invite
    const isAdmin = await verifyRole(auth, 'admin');
    if (!isAdmin) {
      return forbiddenResponse('Admin-Zugriff erforderlich');
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
    }

    const parsed = InviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validierungsfehler', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, full_name, role, club_id: bodyClubId } = parsed.data;

    // Determine target club. auth.clubId is the cookie-aware resolved club
    // for the caller (see lib/auth/resolve-active-club.ts via buildAuthContext).
    // body.clubId is ONLY honored for superadmin — regular admins cannot
    // invite into clubs they don't manage (their admin role is pinned to
    // exactly one club per docs/BUSINESS_RULES.md).
    const targetClubId: string | null =
      auth.role === 'superadmin' ? (bodyClubId ?? auth.clubId) : auth.clubId;
    if (!targetClubId) {
      return NextResponse.json({ error: 'Kein Verein ausgewählt' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server-Konfigurationsfehler: Service-Key fehlt' },
        { status: 500 }
      );
    }

    // Use service role client to invite user (bypasses RLS)
    const adminSupabase = createServerClient(supabaseUrl, supabaseServiceKey, {
      cookies: { getAll: () => [], setAll: () => {} },
    });

    // Check if user already exists in auth.users
    const { data: existingUsers } = await adminSupabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u: { email?: string }) => u.email === email);

    // Enforce: an admin can only be assigned to ONE club
    if (role === 'admin' && existingUser) {
      const { data: adminMemberships } = await adminSupabase
        .from('user_club_memberships')
        .select('id, club_id, clubs(name)')
        .eq('user_id', existingUser.id)
        .eq('role', 'admin')
        .eq('is_active', true)
        .neq('club_id', targetClubId);

      if (adminMemberships && adminMemberships.length > 0) {
        const otherClub = (adminMemberships[0] as Record<string, unknown>).clubs as Record<
          string,
          unknown
        > | null;
        return NextResponse.json(
          {
            error: `Dieser Benutzer ist bereits Admin von "${(otherClub?.name as string) ?? 'einem anderen Verein'}". Ein Admin kann nur einem Verein zugeordnet sein.`,
          },
          { status: 409 }
        );
      }
    }

    let invitedUserId: string;
    let mailSent = true;
    let inviteLink: string | null = null;

    if (existingUser) {
      // User already has an account — just add/update membership
      invitedUserId = existingUser.id;

      // Check if already member of this club
      const { data: existingMembership } = await adminSupabase
        .from('user_club_memberships')
        .select('id, is_active, role')
        .eq('user_id', existingUser.id)
        .eq('club_id', targetClubId)
        .maybeSingle();

      if (existingMembership) {
        if (existingMembership.is_active) {
          return NextResponse.json(
            { error: 'Dieses Mitglied ist bereits aktiv in diesem Verein' },
            { status: 409 }
          );
        }
        // Reactivate
        await adminSupabase
          .from('user_club_memberships')
          .update({ is_active: true, role, status: 'active' })
          .eq('id', existingMembership.id);
      } else {
        // New membership
        await adminSupabase.from('user_club_memberships').insert({
          user_id: existingUser.id,
          club_id: targetClubId,
          role,
          is_active: true,
          status: 'active',
        });
      }
    } else {
      // New user — send invite email via Supabase
      const inviteMeta = {
        full_name: full_name || email.split('@')[0],
        club_id: targetClubId,
        role,
      };
      const redirectTo = `${appBaseUrl()}/dashboard`;

      const { data: inviteData, error: inviteError } =
        await adminSupabase.auth.admin.inviteUserByEmail(email, {
          data: inviteMeta,
          redirectTo,
        });

      let invitedUser = inviteData?.user ?? null;

      // Scheitert der Mailversand (unzustellbare Adresse, SMTP-Ausfall), war die
      // Einladung bisher endgültig verloren — auch jeder weitere Versuch für
      // dieselbe Adresse endete in 500. generate_link legt den Nutzer ohne Versand
      // an und liefert den Link, den der Admin von Hand weitergeben kann.
      if (inviteError || !invitedUser) {
        log.warn('[Invite] Mailversand fehlgeschlagen — weiche auf Einladungslink aus', {
          email,
          reason: inviteError?.message,
        });
        mailSent = false;
        let link = await adminSupabase.auth.admin.generateLink({
          type: 'invite',
          email,
          options: { data: inviteMeta, redirectTo },
        });
        // Existiert der Nutzer bereits (etwa aus einem früheren Fehlversuch),
        // lehnt generate_link den invite-Typ ab — dann genügt ein Anmeldelink.
        if (link.error) {
          link = await adminSupabase.auth.admin.generateLink({
            type: 'magiclink',
            email,
            options: { redirectTo },
          });
        }
        if (link.error || !link.data?.user) {
          log.error('[Invite] Error:', link.error ?? inviteError);
          return NextResponse.json(
            {
              error: `Einladung fehlgeschlagen: ${link.error?.message ?? inviteError?.message ?? 'unbekannter Fehler'}`,
            },
            { status: 502 }
          );
        }
        invitedUser = link.data.user;
        inviteLink = link.data.properties?.action_link ?? null;
      }

      invitedUserId = invitedUser.id;

      // Ensure user is in public.users table
      await adminSupabase.from('users').upsert({
        id: invitedUserId,
        email,
        full_name: full_name || email.split('@')[0],
        updated_at: new Date().toISOString(),
      });

      // Create membership
      await adminSupabase.from('user_club_memberships').insert({
        user_id: invitedUserId,
        club_id: targetClubId,
        role,
        is_active: true,
        status: 'active',
      });
    }

    // If role is trainer, ensure trainers record exists (trainers.id = users.id for FK compatibility)
    if (role === 'trainer') {
      const displayName = full_name || email.split('@')[0];
      const { data: existingTrainer } = await adminSupabase
        .from('trainers')
        .select('id')
        .eq('id', invitedUserId)
        .maybeSingle();

      if (!existingTrainer) {
        await adminSupabase.from('trainers').upsert({
          id: invitedUserId,
          // Ohne user_id ist der Trainer für die Saisonplanung unsichtbar:
          // planning/trainers/route.ts joint users.id = trainers.user_id. Fehlt
          // die Spalte, gilt er dauerhaft als "Präferenzen ausstehend" und wird
          // über seine echte Verfügbarkeit hinweg verplant.
          user_id: invitedUserId,
          email,
          name: displayName,
          specialties: [],
          max_hours_per_week: 30,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }

    // Fetch club name for response
    const { data: club } = await adminSupabase
      .from('clubs')
      .select('name')
      .eq('id', targetClubId)
      .single();

    return NextResponse.json({
      success: true,
      message: existingUser
        ? `${email} wurde zum Verein hinzugefügt.`
        : mailSent
          ? `Einladung an ${email} wurde gesendet.`
          : `${email} wurde angelegt, die E-Mail ließ sich aber nicht zustellen — bitte den Einladungslink von Hand weitergeben.`,
      userId: invitedUserId,
      clubName: club?.name,
      mailSent,
      inviteLink,
    });
  });
}

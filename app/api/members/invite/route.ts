import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { ADMIN_CLUB_COOKIE } from '@/lib/cookies';
import { z } from 'zod';

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

    // Determine target club
    let targetClubId: string | null = auth.clubId;
    if (auth.role === 'superadmin') {
      // Superadmin: use cookie or body club_id
      const cookieClubId = request.cookies.get(ADMIN_CLUB_COOKIE)?.value;
      targetClubId = bodyClubId || cookieClubId || null;
    }

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

    let invitedUserId: string;

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
      const { data: inviteData, error: inviteError } =
        await adminSupabase.auth.admin.inviteUserByEmail(email, {
          data: {
            full_name: full_name || email.split('@')[0],
            club_id: targetClubId,
            role,
          },
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://swingz.vercel.app'}/dashboard`,
        });

      if (inviteError || !inviteData?.user) {
        console.error('[Invite] Error:', inviteError);
        return NextResponse.json(
          { error: inviteError?.message || 'Einladung konnte nicht gesendet werden' },
          { status: 500 }
        );
      }

      invitedUserId = inviteData.user.id;

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
        : `Einladung an ${email} wurde gesendet.`,
      userId: invitedUserId,
      clubName: club?.name,
    });
  });
}

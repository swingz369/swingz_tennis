/**
 * POST /api/owner/invite-admin
 * Owner legt einen Admin-Account für einen Verein an und schickt Einladungsmail.
 * Nur für owner-Rolle zugänglich.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:owner:invite-admin');

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const isOwner = await verifyRole(auth, 'owner');
    if (!isOwner) return forbiddenResponse('Owner access required');

    const { email, fullName, clubId } = await request.json();

    if (!email || !clubId) {
      return NextResponse.json({ error: 'E-Mail und Verein sind erforderlich' }, { status: 400 });
    }

    const sb = createServiceClient();

    const { data: club } = await sb.from('clubs').select('id, name').eq('id', clubId).maybeSingle();
    if (!club) return NextResponse.json({ error: 'Verein nicht gefunden' }, { status: 404 });

    // Supabase Admin Invite — schickt automatisch Setup-E-Mail
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const inviteRes = await fetch(`${supabaseUrl}/auth/v1/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        email,
        data: { full_name: fullName || email.split('@')[0] },
        redirect_to: `${process.env.NEXT_PUBLIC_APP_URL}/login?invited=1`,
      }),
    });

    const inviteJson = await inviteRes.json().catch(() => null);

    if (!inviteRes.ok && !inviteJson?.msg?.includes('already')) {
      log.error('Supabase invite failed', inviteJson);
      return NextResponse.json(
        { error: inviteJson?.msg ?? 'Einladung fehlgeschlagen' },
        { status: 500 }
      );
    }

    const userId: string | undefined = inviteJson?.id;

    if (userId) {
      await sb
        .from('users')
        .upsert(
          { id: userId, email, full_name: fullName || email.split('@')[0] },
          { onConflict: 'id' }
        );

      const { error: membershipErr } = await sb
        .from('user_club_memberships')
        .upsert(
          { user_id: userId, club_id: clubId, role: 'admin', is_active: true },
          { onConflict: 'user_id,club_id' }
        );

      if (membershipErr) {
        log.error('Membership creation failed', membershipErr);
        return NextResponse.json(
          { error: 'Mitgliedschaft konnte nicht erstellt werden' },
          { status: 500 }
        );
      }
    }

    log.info('Admin invited', { email, clubId, clubName: club.name });
    return NextResponse.json({ success: true, clubName: club.name });
  });
}

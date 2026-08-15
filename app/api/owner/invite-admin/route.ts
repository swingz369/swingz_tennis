/**
 * POST /api/owner/invite-admin
 * Owner legt einen Admin-Account für einen Verein an und schickt Einladungsmail.
 * Nur für owner-Rolle zugänglich.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { logAudit } from '@/lib/audit';
import { createLogger } from '@/lib/logger';
import { appBaseUrl } from '@/lib/app-url';

const log = createLogger('api:owner:invite-admin');

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const isOwner = await verifyRole(auth, 'owner');
    if (!isOwner) return forbiddenResponse('Zugriff nur für den Plattformbetreiber');

    const { email, fullName, clubId, role: inviteRole = 'admin' } = await request.json();

    if (!['admin', 'superadmin'].includes(inviteRole)) {
      return NextResponse.json({ error: 'Ungültige Rolle' }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: 'E-Mail ist erforderlich' }, { status: 400 });
    }
    // admin must have a club; superadmin club is optional
    if (inviteRole === 'admin' && !clubId) {
      return NextResponse.json({ error: 'E-Mail und Verein sind erforderlich' }, { status: 400 });
    }

    const sb = createServiceClient();

    let club: { id: string; name: string } | null = null;
    if (clubId) {
      const { data } = await sb.from('clubs').select('id, name').eq('id', clubId).maybeSingle();
      if (!data) return NextResponse.json({ error: 'Verein nicht gefunden' }, { status: 404 });
      club = data;
    }

    // Supabase Admin Invite — schickt automatisch Setup-E-Mail
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const redirectTo = `${appBaseUrl()}/login?invited=1`;
    const goTrue = async (path: string, payload: Record<string, unknown>) => {
      const res = await fetch(`${supabaseUrl}/auth/v1/${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify(payload),
      });
      return { ok: res.ok, json: await res.json().catch(() => null) };
    };

    const userData = { full_name: fullName || email.split('@')[0] };

    let invite = await goTrue('invite', { email, data: userData, redirect_to: redirectTo });
    let inviteLink: string | null = null;
    let mailSent = true;

    // Ohne Fallback ist eine unzustellbare Adresse eine Sackgasse: GoTrue scheitert
    // am Versand, bevor es "already registered" meldet — jeder weitere Versuch für
    // dieselbe Adresse endet wieder in 500, der Verein bekommt nie einen Admin.
    // generate_link legt den Nutzer ohne Mailversand an und liefert den Link, den
    // der Owner dann von Hand weitergibt.
    if (!invite.ok && !invite.json?.msg?.includes('already')) {
      log.warn('Einladungsmail nicht zustellbar — weiche auf Einladungslink aus', {
        email,
        reason: invite.json?.msg,
      });
      mailSent = false;
      invite = await goTrue('admin/generate_link', {
        type: 'invite',
        email,
        data: userData,
        redirect_to: redirectTo,
      });
      // Existiert der Nutzer schon (etwa aus einem früheren Fehlversuch), lehnt
      // generate_link den invite-Typ ab — dann genügt ein Anmeldelink.
      if (!invite.ok) {
        invite = await goTrue('admin/generate_link', {
          type: 'magiclink',
          email,
          redirect_to: redirectTo,
        });
      }
      inviteLink = invite.json?.action_link ?? null;
    }

    if (!invite.ok && !invite.json?.msg?.includes('already')) {
      log.error('Supabase invite failed', invite.json);
      return NextResponse.json(
        { error: `Einladung fehlgeschlagen: ${invite.json?.msg ?? 'unbekannter Fehler'}` },
        { status: 502 }
      );
    }

    const inviteJson = invite.json;
    const userId: string | undefined = inviteJson?.id ?? inviteJson?.user?.id;

    // Hoist pre-flight-Variablen auf if(userId)-Scope, weil sie UNTERHALB
    // des if(clubId)-Blocks im Audit-Details referenziert werden (Block-Scoping
    // würde sonst TS6133 werfen).
    let reactivation = false;
    let anyClubMembershipExists = false;

    if (userId) {
      // Pre-flight: zwei verschiedene Audit-relevante Zustände.
      //   1) reactivation (exactMatch): existiert bereits eine Membership für
      //      (user, club, role)? Falls ja ist die jetzige Einladung eine
      //      REAKTIVIERUNG — eigenes Audit-Flag (Common-Case: false).
      //   2) anyClubMembershipExists (anyMatch): gibt es IRGENDEINE
      //      Membership-Row für (user, club) in einer ANDEREN Rolle? Selbst
      //      wenn der User vorher nur Member war, ist die jetzige
      //      Admin-Einladung eine ROLLEN-ESCALATION mit bestehendem
      //      Vereinsbezug → Audit-Leser sehen das über
      //      details.previous_club_relationship.
      // Conditional Sequencing: die teurere 2. Query läuft nur wenn die
      // 1. Query KEIN exaktes Match findet. Spart einen Roundtrip im
      // Common-Case (frische Erst-Einladung). Beide robust gegen
      // Supabase-MSG-Lokalisierung (stringbasiertes MSG-Matching würde
      // bei i18n brechen).
      if (clubId) {
        const { data: exactMatch } = await sb
          .from('user_club_memberships')
          .select('id')
          .eq('user_id', userId)
          .eq('club_id', clubId)
          .eq('role', inviteRole)
          .maybeSingle();
        reactivation = !!exactMatch;

        if (!reactivation) {
          const { data: anyMatch } = await sb
            .from('user_club_memberships')
            .select('id')
            .eq('user_id', userId)
            .eq('club_id', clubId)
            .maybeSingle();
          anyClubMembershipExists = !!anyMatch;
        }
      }

      await sb
        .from('users')
        .upsert(
          { id: userId, email, full_name: fullName || email.split('@')[0] },
          { onConflict: 'id' }
        );

      if (clubId) {
        const { error: membershipErr } = await sb
          .from('user_club_memberships')
          .upsert(
            { user_id: userId, club_id: clubId, role: inviteRole, is_active: true },
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
    }

    log.info(`${inviteRole} invited`, { email, clubId, clubName: club?.name });

    // AuditLog-Pflicht (CLAUDE.md): jede Owner-Mutation erfasst eine Zeile in
    // audit_logs mit actor=Aktor-UserID, action=invite, resource_type=membership,
    // resource_id=userId (semantischer Anker: der neu eingeladene User).
    // details enthält den vollen Kontext, damit das /owner/audit-Log die
    // Aktion später rekonstruieren kann ohne JOIN auf andere Tabellen.
    // resource_id ist NOT NULL: fehlt die userId (Invite ohne angelegten User),
    // trägt logAudit die Zeile an der club_id — die Zuordnung bleibt lesbar.
    await logAudit({
      actorId: auth.user.id,
      action: 'invite',
      resourceType: 'membership',
      resourceId: userId ?? null,
      clubId: club?.id ?? null,
      details: {
        email,
        full_name: fullName ?? email.split('@')[0],
        invited_role: inviteRole,
        club_name: club?.name ?? null,
        reactivation: reactivation,
        previous_club_relationship: anyClubMembershipExists,
        mail_sent: mailSent,
      },
      request,
    });

    return NextResponse.json({ success: true, clubName: club?.name, mailSent, inviteLink });
  });
}

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
    try {
      await sb.from('audit_logs').insert({
        actor_id: auth.user.id,
        action: 'invite',
        resource_type: 'membership',
        resource_id: userId ?? null,
        club_id: club?.id ?? null,
        details: {
          email,
          full_name: fullName ?? email.split('@')[0],
          invited_role: inviteRole,
          club_name: club?.name ?? null,
          reactivation: reactivation,
          previous_club_relationship: anyClubMembershipExists,
        },
      });
    } catch (auditErr) {
      // Audit-Failure darf die Haupt-Aktion nicht rollbacken — Logging ist
      // 'super-best-effort'. Fehler wird geloggt, damit Ops es nachverfolgen kann.
      log.warn('AuditLog insert failed for invite (non-fatal)', {
        email,
        auditErr: auditErr instanceof Error ? auditErr.message : String(auditErr),
      });
    }

    return NextResponse.json({ success: true, clubName: club?.name });
  });
}

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiAuth, verifyRole, forbiddenResponse, unauthorizedResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import { ALL_OFFICE_ROLES, sanitizeOfficeFlags, type OfficeFlagMap } from '@/lib/auth-common';

export const dynamic = 'force-dynamic';

const log = createLogger('api:admin:members:office-flags');

// ──────────────────────────────────────────────────────────────────────────
// Zod-Schema für das PATCH-Body. Defense-Layer #1: HTTP-Body-Form prüfen.
// Komplementär zu `sanitizeOfficeFlags` (Defense-Layer #2 nach raw-Lookup).
// ──────────────────────────────────────────────────────────────────────────

// Strikte Enum-Validierung: nur bekannte OfficeRole-Keys erlaubt.
const OfficeFlagValue = z.boolean();
const OfficeFlagsBody = z
  .object({
    office_flags: z.record(
      z.enum(ALL_OFFICE_ROLES as unknown as [string, ...string[]]),
      OfficeFlagValue
    ),
  })
  .strict(); // Verwerfe unbekannte Top-Level-Keys früh.

// ──────────────────────────────────────────────────────────────────────────
// PATCH-Handler
// ──────────────────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    // 1. Rate-Limit (PATCH ist mutativ — STRICT-Bucket, default 30 req / 5 min)
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);
    if (rateLimitError) return rateLimitError;

    // 2. Rolle: Admin oder höher (Owner/Superadmin haben implizit Zugriff)
    const hasRole = await verifyRole(auth, 'admin');
    if (!hasRole) {
      return forbiddenResponse('Admin-Berechtigung erforderlich zum Ändern von Ämtern');
    }

    const { id: membershipId } = await params;
    if (!membershipId) return unauthorizedResponse('Membership-ID fehlt');

    // 3. Zod-Parse Body
    let body: z.infer<typeof OfficeFlagsBody>;
    try {
      const rawBody = await request.json();
      body = OfficeFlagsBody.parse(rawBody);
    } catch (zodError) {
      log.warn('Invalid PATCH body for office-flags', {
        membershipId,
        error: zodError instanceof z.ZodError ? zodError.issues : String(zodError),
      });
      return NextResponse.json(
        {
          error:
            'Ungültiger Body. Erwartet: { office_flags: { kassenwart?: boolean, jugendwart?: boolean, platzwart?: boolean, mannschaftsfuehrer?: boolean, turnierleiter?: boolean } }',
        },
        { status: 400 }
      );
    }

    // 4. Defense-Layer #2 — re-sanitize nach Zod (zod-Validierung sollte dies
    //    bereits leisten, aber hält den Code robust gegen zod-Config-Changes)
    const sanitizedFlags: OfficeFlagMap = sanitizeOfficeFlags(body.office_flags);

    // 5. Service-Client für RLS-bypass (Admin-Operationen sind erlaubt sich
    //    über Row-Level-Security hinwegzusetzen, auditiert via actor_id in Tabelle)
    const serviceSb = createServiceClient();

    // 6. Vor-Read: Bestätige dass Membership existiert + gehört zu auth.clubId
    const { data: existing, error: readError } = await serviceSb
      .from('user_club_memberships')
      .select('id, user_id, club_id')
      .eq('id', membershipId)
      .maybeSingle();

    if (readError) {
      log.error('Failed to read membership for office-flags PATCH', {
        membershipId,
        error: readError,
      });
      return NextResponse.json(
        { error: 'Datenbankfehler beim Lesen der Mitgliedschaft' },
        { status: 500 }
      );
    }
    if (!existing)
      return NextResponse.json({ error: 'Mitgliedschaft nicht gefunden' }, { status: 404 });
    // Superadmin darf alle Clubs; Admin nur den eigenen.
    if (auth.role !== 'superadmin' && auth.role !== 'owner' && existing.club_id !== auth.clubId) {
      log.warn('Club-mismatch on office-flags PATCH', {
        membershipId,
        actorClub: auth.clubId,
        targetClub: existing.club_id,
        actorRole: auth.role,
      });
      return forbiddenResponse('Du kannst nur Ämter im eigenen Verein vergeben');
    }

    // 7. Read old flags für Diff im Audit-Log (vorher/nachher)
    const { data: prev } = await serviceSb
      .from('user_club_memberships')
      .select('office_flags')
      .eq('id', membershipId)
      .maybeSingle();
    const prevFlags: OfficeFlagMap = sanitizeOfficeFlags(
      (prev as { office_flags?: unknown } | null)?.office_flags
    );

    // 8. Update
    const { data: updated, error: updateError } = await serviceSb
      .from('user_club_memberships')
      .update({ office_flags: sanitizedFlags })
      .eq('id', membershipId)
      .select('office_flags')
      .maybeSingle();

    if (updateError) {
      log.error('Failed to update office_flags', {
        membershipId,
        error: updateError,
      });
      return NextResponse.json({ error: 'Datenbankfehler beim Speichern' }, { status: 500 });
    }
    if (!updated)
      return NextResponse.json({ error: 'Mitgliedschaft nicht gefunden' }, { status: 404 });

    // 9. Audit-Log: Pflicht bei Berechtigungs-Änderungen (DSGVO Art. 5 Abs. 2 +
    //    GoBD § 146 AO — Nachvollziehbarkeit der Ämter-Vergabe).
    const changedRoles: string[] = [];
    for (const role of ALL_OFFICE_ROLES) {
      const wasOn = prevFlags[role] === true;
      const isOn = sanitizedFlags[role] === true;
      if (wasOn !== isOn) {
        changedRoles.push(`${role}: ${wasOn ? 'on' : 'off'} → ${isOn ? 'on' : 'off'}`);
      }
    }
    try {
      await (serviceSb.from('audit_logs').insert({
        action: 'UPDATE_OFFICE_FLAGS',
        actor_id: auth.user.id,
        resource_type: 'membership',
        resource_id: membershipId,
        details: {
          target_user_id: existing.user_id,
          target_club_id: existing.club_id,
          changes: changedRoles,
          final_flags: sanitizedFlags,
        },
      }) as unknown as Promise<{ error: unknown }>);
    } catch (auditError) {
      // Audit-Log-Fehler dürfen das User-Update NICHT rollbacken (wir loggen,
      // melden aber kein 500 — die eigentliche Operation war erfolgreich).
      log.error('Audit-Log insert failed for office-flags', {
        membershipId,
        error: auditError,
      });
    }

    log.info('Office-Flags aktualisiert', {
      membershipId,
      actorId: auth.user.id,
      changes: changedRoles.length,
    });

    // 10. Response: Sanitized + garantiert vollständig (alle 5 Rollen vorhanden)
    const filledFlags = {
      ...sanitizedFlags,
      kassenwart: sanitizedFlags.kassenwart === true,
      jugendwart: sanitizedFlags.jugendwart === true,
      platzwart: sanitizedFlags.platzwart === true,
      mannschaftsfuehrer: sanitizedFlags.mannschaftsfuehrer === true,
      turnierleiter: sanitizedFlags.turnierleiter === true,
    };
    return NextResponse.json({ office_flags: filledFlags }, { status: 200 });
  });
}

/**
 * PATCH /api/owner/memberships/[id]
 *
 * Owner-gated Mutation für einzelne user_club_membership-Rows.
 *
 * Use-Cases:
 * 1) Admin deaktivieren/reaktivieren (typischer Workflow: Admin ist ausgeschieden,
 *    Verein muss ohne Admin arbeiten oder neuer Admin wird gleich eingeladen).
 * 2) Superadmin um weitere Vereine erweitern (Tennisschule wächst).
 * 3) Superadmin aus einem Verein herausnehmen (Vertrag endet, Kooperation beendet).
 *
 * Defense-in-depth (warum Owner hier mit Service-Client operiert):
 * - RLS erlaubt `is_owner()` SELECT, aber kein UPDATE auf beliebige Rows.
 * - Owner operiert plattformweit, RLS wäre hinderlich.
 * - Wir verlassen uns auf verifyRole('owner') + expliziten Block auf 'owner'-Role-Rows
 *   + self-mutation-Schutz.
 *
 * Body-Shape (alle Felder optional; mind. eines muss anliegen):
 *   {
 *     is_active?: boolean,
 *     club_ids_assign?:  uuid[],   // nur sinnvoll fuer superadmin
 *     club_ids_remove?:  uuid[],   // nur sinnvoll fuer superadmin
 *   }
 *
 * Idempotenz:
 * - is_active = aktueller Wert → 200 ohne Mutation (kein Audit-No-Op-Log)
 * - club_ids_assign/-remove sind Set-Operationen; doppelte Anwendung ist No-Op.
 *
 * Audit: action='update', resource_type='membership', resource_id=membershipId,
 *         details.kind='admin_toggle' | 'superadmin_toggle' | 'superadmin_assign' |
 *                        'superadmin_remove'
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:owner:memberships');

const ALLOWED_ROLES = new Set(['admin', 'superadmin']);

interface PatchBody {
  is_active?: boolean;
  club_ids_assign?: string[];
  club_ids_remove?: string[];
}

function isUuidArray(v: unknown): v is string[] {
  return (
    Array.isArray(v) &&
    v.every(
      (x) =>
        typeof x === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x)
    )
  );
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'owner'))) {
      return forbiddenResponse('Owner access required');
    }

    const { id: membershipId } = await ctx.params;
    if (!/^[0-9a-f-]{36}$/i.test(membershipId)) {
      return NextResponse.json({ error: 'Ungültige Membership-ID' }, { status: 400 });
    }

    let body: PatchBody;
    try {
      body = (await request.json()) as PatchBody;
    } catch {
      return NextResponse.json({ error: 'Body muss valides JSON sein' }, { status: 400 });
    }

    // Whitelist: nur erlaubte Felder parsen; unbekannte Felder werden ignoriert
    // (verhindert versehentliches Schema-Wildwuchs).
    const patch: PatchBody = {};
    if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;
    if (isUuidArray(body.club_ids_assign)) patch.club_ids_assign = body.club_ids_assign;
    if (isUuidArray(body.club_ids_remove)) patch.club_ids_remove = body.club_ids_remove;

    if (
      patch.is_active === undefined &&
      !patch.club_ids_assign?.length &&
      !patch.club_ids_remove?.length
    ) {
      return NextResponse.json(
        { error: 'Mindestens is_active, club_ids_assign oder club_ids_remove erforderlich' },
        { status: 400 }
      );
    }

    const sb = createServiceClient();

    // Vorab-Load: wir brauchen role + user_id zur Rollen-Gate-Pruefung.
    const { data: current, error: curErr } = await sb
      .from('user_club_memberships')
      .select('id, user_id, club_id, role, is_active')
      .eq('id', membershipId)
      .maybeSingle();

    if (curErr) {
      log.error('Read membership failed', curErr);
      return NextResponse.json({ error: 'Membership-Lookup fehlgeschlagen' }, { status: 500 });
    }
    if (!current) {
      return NextResponse.json({ error: 'Membership nicht gefunden' }, { status: 404 });
    }
    if (!ALLOWED_ROLES.has(current.role)) {
      // Besonders: 'owner' ist blockiert — Owner darf sich nicht selbst entmachten.
      log.warn('Refused membership mutation on protected role', {
        membershipId,
        role: current.role,
      });
      return NextResponse.json(
        { error: `Membership-Rolle "${current.role}" kann nicht via Owner-PATCH geändert werden` },
        { status: 403 }
      );
    }
    if (current.user_id === auth.user.id) {
      // Self-mutation blockiert: Owner darf sich nicht selbst die Admin-/Superadmin-Rolle entziehen.
      return NextResponse.json(
        { error: 'Eigene Membership kann via Owner-PATCH nicht geändert werden' },
        { status: 403 }
      );
    }

    // club_ids_assign/-remove nur fuer superadmin (Admin = genau 1 Verein laut CLAUDE.md).
    const isSuper = current.role === 'superadmin';
    if ((patch.club_ids_assign?.length || patch.club_ids_remove?.length) && !isSuper) {
      return NextResponse.json(
        { error: 'Vereinszuweisung/Herausnahme nur für Superadmin-Memberships erlaubt' },
        { status: 400 }
      );
    }

    // 409 beim No-Op: vermeidet Audit-No-Op-Logs, identisches Verhalten zur Restore-Route.
    const noChange =
      (patch.is_active === undefined || patch.is_active === current.is_active) &&
      !patch.club_ids_assign?.length &&
      !patch.club_ids_remove?.length;
    if (noChange) {
      return NextResponse.json(
        {
          error:
            'Keine Änderung — is_active entspricht bereits dem aktuellen Wert und keine Vereinsänderung',
          membership: current,
        },
        { status: 409 }
      );
    }

    const mutations: string[] = []; // fuer Audit
    const warnings: string[] = [];
    let removedMembershipIds: string[] = [];
    const affectedUsers: string[] = [current.user_id];

    // Multi-Sub-Mutations (is_active + Vereins-Set-Operationen) sind NICHT atomar
    // (Service-Client ohne db.transaction()-Wrapper). Sequentielle Ausfuehrung —
    // bei Mid-Request-Fehler ist die DB moeglicherweise halb-mutiert; der
    // Audit-Log-Eintrag dokumentiert dann genau welche Teile gelaufen sind.

    // 1) is_active-Toggle (single row, je nach Rolle)
    if (typeof patch.is_active === 'boolean' && patch.is_active !== current.is_active) {
      const { error } = await sb
        .from('user_club_memberships')
        .update({
          is_active: patch.is_active,
          deactivated_at: patch.is_active ? null : new Date().toISOString(),
          deactivated_by: patch.is_active ? null : auth.user.id,
        })
        .eq('id', membershipId);
      if (error) {
        log.error('Toggle membership failed', error);
        return NextResponse.json(
          { error: 'Aktivieren/Deaktivieren fehlgeschlagen' },
          { status: 500 }
        );
      }
      mutations.push(patch.is_active ? 'reactivate' : 'deactivate');
    }

    // 2) Superadmin: weitere Vereine hinzufuegen
    if (isSuper && patch.club_ids_assign?.length) {
      // Pruefe Existenz aller Clubs einmal, dann Bulk-Upsert (idempotent dank unique(user_id,club_id)).
      const { data: clubs } = await sb.from('clubs').select('id').in('id', patch.club_ids_assign);
      const existingIds = (clubs ?? []).map((c) => c.id);
      if (existingIds.length !== patch.club_ids_assign.length) {
        const missing = patch.club_ids_assign.filter((id) => !existingIds.includes(id));
        return NextResponse.json(
          { error: `Vereine nicht gefunden: ${missing.join(', ')}` },
          { status: 404 }
        );
      }
      const rows = patch.club_ids_assign.map((clubId) => ({
        user_id: current.user_id,
        club_id: clubId,
        role: 'superadmin' as const,
        is_active: true,
        joined_at: new Date().toISOString(),
      }));
      const { error } = await sb
        .from('user_club_memberships')
        .upsert(rows, { onConflict: 'user_id,club_id', ignoreDuplicates: true });
      if (error) {
        log.error('Assign clubs failed', error);
        return NextResponse.json({ error: 'Vereinszuweisung fehlgeschlagen' }, { status: 500 });
      }
      mutations.push('assign_clubs');
    }

    // 3) Superadmin: Vereine herausnehmen
    if (isSuper && patch.club_ids_remove?.length) {
      // Wir deaktivieren (soft) statt loeschen, damit Audit-Historie erhaelt bleibt.
      // Das verhindert versehentliches Hard-Loeschen einer historisch wichtigen Membership.
      const { data: removedRows, error } = await sb
        .from('user_club_memberships')
        .update({
          is_active: false,
          deactivated_at: new Date().toISOString(),
          deactivated_by: auth.user.id,
        })
        .eq('user_id', current.user_id)
        .eq('role', 'superadmin')
        .in('club_id', patch.club_ids_remove)
        .select('id, club_id');
      if (error) {
        log.error('Remove clubs failed', error);
        return NextResponse.json({ error: 'Vereins-Herausnahme fehlgeschlagen' }, { status: 500 });
      }
      removedMembershipIds = (removedRows ?? []).map((r) => r.id as string);
      mutations.push('remove_clubs');

      // Operativer Schutz: Wenn der Superadmin danach keinen aktiven Verein mehr hat,
      // dokumentieren wir das im Response + Audit. Es gibt keine Mindestzahl-Clause
      // in CLAUDE.md, aber ein funktionsloser Superadmin ist operativ verwirrend.
      const { count: remaining } = await sb
        .from('user_club_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', current.user_id)
        .eq('role', 'superadmin')
        .eq('is_active', true);
      if ((remaining ?? 0) === 0) {
        warnings.push('Superadmin hat keine aktiven Vereine mehr.');
      }
    }

    // 4) AuditLog: alle Mutationen zusammen loggen (eine Row pro PATCH-Request).
    await sb.from('audit_logs').insert({
      actor_id: auth.user.id,
      action: 'update',
      resource_type: 'membership',
      resource_id: membershipId,
      club_id: current.club_id,
      details: {
        kind: mutations.join('+') || 'noop',
        target_user_id: current.user_id,
        target_role: current.role,
        is_active_was: current.is_active,
        is_active_now: patch.is_active ?? current.is_active,
        clubs_assigned: patch.club_ids_assign ?? [],
        clubs_removed: patch.club_ids_remove ?? [],
        affected_membership_ids: removedMembershipIds,
        warnings,
        multi_mutation_not_atomic: true,
      },
      ip_address: request.headers.get('x-forwarded-for') ?? null,
      user_agent: request.headers.get('user-agent') ?? null,
    });

    log.info('Membership updated by owner', {
      actor: auth.user.id,
      target_user: current.user_id,
      role: current.role,
      mutations,
    });

    return NextResponse.json({
      success: true,
      membership_id: membershipId,
      mutations,
      affected_users: affectedUsers,
      warnings,
    });
  });
}

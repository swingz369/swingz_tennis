import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { getPagination, buildPaginationMeta } from '@/lib/pagination';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:owner:audit-logs');

/**
 * GET /api/owner/audit-logs
 *
 * Plattformweiter Audit-Log — nur Owner.
 * Service-Client umgeht RLS bewusst, weil Owner Vereins-übergreifend liest.
 * RLS-Schutz bleibt über die strikte verifyRole('owner')-Guard.
 *
 * Filter (alle optional):
 *   - club_id           direkt auf audit_logs.club_id
 *   - actor_email       partial match (.ilike %term%) — via Lookup der
 *                       zugehörigen user_ids (Supabase-JS unterstützt kein
 *                       inner-join mit ilike auf gejointem Feld zuverlässig)
 *   - action            exakter match
 *   - resource_type     exakter match
 *   - from/to           ISO-Datumsstring (YYYY-MM-DD), created_at-Range
 *
 * Limit: Default 50, max 100 (UI-Cap; höhere Limits wären Explorer-Tool, nicht Dashboard).
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'owner'))) {
      return forbiddenResponse('Owner access required');
    }

    try {
      const { searchParams } = new URL(request.url);
      const params = Object.fromEntries(searchParams.entries());

      // Cap UI limit defensively
      const rawLimit = parseInt(params.limit ?? '', 10);
      const safeLimit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 50 : rawLimit));
      const { page, offset } = getPagination({ ...params, limit: String(safeLimit) }, safeLimit);

      const clubId = params.club_id?.trim() || null;
      const actorEmail = params.actor_email?.trim() || null;
      const action = params.action?.trim() || null;
      const resourceType = params.resource_type?.trim() || null;
      const from = params.from?.trim() || null;
      const to = params.to?.trim() || null;

      const sb = createServiceClient();

      // Schritt 1: Wenn nach Actor-E-Mail gefiltert wird, vorher die passenden
      // user_ids auflösen. Wir verwenden einen Lookup und nicht einen inner-join,
      // weil Supabase-JS keine zuverlässig-eingebettete ilike-on-joined erlaubt.
      let actorIds: string[] | null = null;
      if (actorEmail) {
        const { data: matchingUsers, error: userErr } = await sb
          .from('users')
          .select('id')
          .ilike('email', `%${actorEmail}%`)
          .limit(500); // hard cap für Matches (sehr locker)
        if (userErr) throw userErr;
        actorIds = (matchingUsers ?? []).map((u: { id: string }) => u.id);
        // Wenn niemand matcht: leeres Ergebnis früh zurück (keine teure Query)
        if (actorIds.length === 0) {
          return NextResponse.json({
            logs: [],
            pagination: buildPaginationMeta(page, safeLimit, 0),
          });
        }
      }

      // Schritt 2: Audit-Logs-Query mit Filtern
      let query = sb
        .from('audit_logs')
        .select(
          'id, created_at, actor_id, action, resource_type, resource_id, club_id, details, ip_address, user_agent, actor:actor_id(full_name, email), club:club_id(name)',
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + safeLimit - 1);

      if (clubId) query = query.eq('club_id', clubId);
      if (actorIds) query = query.in('actor_id', actorIds);
      if (action) query = query.eq('action', action);
      if (resourceType) query = query.eq('resource_type', resourceType);
      if (from) query = query.gte('created_at', `${from}T00:00:00.000Z`);
      if (to) query = query.lte('created_at', `${to}T23:59:59.999Z`);

      // Supabase liefert mit `{ count: 'exact' }` die exakte Trefferanzahl
      // zur selben Query zurück — kein zweiter Count-Roundtrip nötig.
      const { data: rows, error: rowsErr, count } = await query;
      if (rowsErr) throw rowsErr;

      const logs = (rows ?? []).map((row: any) => ({
        id: row.id,
        created_at: row.created_at,
        actor_id: row.actor_id,
        actor_name: row.actor?.full_name ?? null,
        actor_email: row.actor?.email ?? null,
        action: row.action,
        resource_type: row.resource_type,
        resource_id: row.resource_id,
        club_id: row.club_id,
        club_name: row.club?.name ?? null,
        details: row.details ?? {},
        ip_address: row.ip_address ?? null,
        user_agent: row.user_agent ?? null,
      }));

      const pagination = buildPaginationMeta(page, safeLimit, count);
      return NextResponse.json({ logs, pagination });
    } catch (error) {
      log.error('Failed to fetch owner audit logs', error instanceof Error ? error : undefined);
      return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
    }
  });
}

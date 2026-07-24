import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import { format } from 'date-fns';

const log = createLogger('api:owner:audit-logs:export');

const EXPORT_MAX_ROWS = 10_000;

/**
 * GET /api/owner/audit-logs/export
 *
 * CSV-Export der gefilterten Audit-Logs (Owner-only).
 * Exakt dieselben Filter wie GET /api/owner/audit-logs.
 * Cap: 10.000 Zeilen, um Speicher-/Response-Limits nicht zu sprengen.
 *
 * Hinweis: Bei größeren Datenmengen ist die Filterung der bessere Weg —
 * dies ist ein Audit-/Compliance-Export, kein Bulk-Data-Dump.
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'owner'))) {
      return forbiddenResponse('Owner access required');
    }

    try {
      const { searchParams } = new URL(request.url);
      const clubId = searchParams.get('club_id')?.trim() || null;
      const actorEmail = searchParams.get('actor_email')?.trim() || null;
      const action = searchParams.get('action')?.trim() || null;
      const resourceType = searchParams.get('resource_type')?.trim() || null;
      const from = searchParams.get('from')?.trim() || null;
      const to = searchParams.get('to')?.trim() || null;

      const sb = createServiceClient();

      // Actor-Email Lookup (analog zur GET-Route)
      let actorIds: string[] | null = null;
      if (actorEmail) {
        const { data, error } = await sb
          .from('users')
          .select('id')
          .ilike('email', `%${actorEmail}%`)
          .limit(500);
        if (error) throw error;
        actorIds = (data ?? []).map((u: { id: string }) => u.id);
        if (actorIds.length === 0) {
          // Nichts matcht → leere CSV zurückgeben (kein JOIN-Overhead)
          return csvResponse([], { clubId, actorEmail, action, resourceType, from, to });
        }
      }

      let query = sb
        .from('audit_logs')
        .select(
          'id, created_at, actor_id, action, resource_type, resource_id, club_id, ip_address, user_agent, details, actor:actor_id(full_name, email), club:club_id(name)'
        )
        .order('created_at', { ascending: false })
        .limit(EXPORT_MAX_ROWS);

      if (clubId) query = query.eq('club_id', clubId);
      if (actorIds) query = query.in('actor_id', actorIds);
      if (action) query = query.eq('action', action);
      if (resourceType) query = query.eq('resource_type', resourceType);
      if (from) query = query.gte('created_at', `${from}T00:00:00.000Z`);
      if (to) query = query.lte('created_at', `${to}T23:59:59.999Z`);

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []).map((row: any) => ({
        id: row.id,
        created_at: row.created_at,
        actor_name: row.actor?.full_name ?? '',
        actor_email: row.actor?.email ?? '',
        action: row.action,
        resource_type: row.resource_type,
        resource_id: row.resource_id,
        club_name: row.club?.name ?? '',
        ip_address: row.ip_address ?? '',
        user_agent: row.user_agent ?? '',
        details: JSON.stringify(row.details ?? {}),
      }));

      return csvResponse(rows, { clubId, actorEmail, action, resourceType, from, to });
    } catch (error) {
      log.error('Failed to export owner audit logs', error instanceof Error ? error : undefined);
      return NextResponse.json({ error: 'Failed to export audit logs' }, { status: 500 });
    }
  });
}

function csvResponse(
  rows: Array<Record<string, string>>,
  meta: {
    clubId: string | null;
    actorEmail: string | null;
    action: string | null;
    resourceType: string | null;
    from: string | null;
    to: string | null;
  }
): NextResponse {
  const headers = [
    'Timestamp',
    'Actor Name',
    'Actor Email',
    'Action',
    'Resource Type',
    'Resource ID',
    'Club',
    'IP Address',
    'User Agent',
    'Details',
  ];

  const escape = (v: string): string => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.created_at,
        row.actor_name,
        row.actor_email,
        row.action,
        row.resource_type,
        row.resource_id,
        row.club_name,
        row.ip_address,
        row.user_agent,
        row.details,
      ]
        .map(escape)
        .join(',')
    );
  }

  const csv = lines.join('\n');
  const suffix = [
    meta.clubId ? `club-${meta.clubId.slice(0, 8)}` : null,
    meta.from ? `from-${meta.from}` : null,
    meta.to ? `to-${meta.to}` : null,
  ]
    .filter(Boolean)
    .join('_');
  const filename = `swingz-audit-logs_${suffix || 'all'}_${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

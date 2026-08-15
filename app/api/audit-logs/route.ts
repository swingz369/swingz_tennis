import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:audit-logs');

/**
 * @swagger
 * /api/audit-logs:
 *   get:
 *     summary: Get audit logs
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: club_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: entity_type
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *       401:
 *         description: Unauthorized
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { searchParams } = new URL(request.url);
      const limit = parseInt(searchParams.get('limit') || '50');
      const offset = parseInt(searchParams.get('offset') || '0');
      const clubId = searchParams.get('club_id');
      const action = searchParams.get('action');
      const entityType = searchParams.get('entity_type');

      const supabase = await createClient();

      let query = supabase
        .from('audit_logs')
        .select('*, actor:actor_id(email, full_name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Vereins-Filter läuft über audit_logs.club_id. Vorher stand hier
      // `resource_type='club' AND resource_id=<clubId>` — das trifft nur
      // Mutationen AM Verein selbst, nie die Einträge DES Vereins, und lieferte
      // deshalb praktisch immer eine leere Liste.
      // Ohne expliziten Filter greift RLS (audit_logs_admin_select →
      // is_club_admin(club_id)) und scopet auf die eigenen Vereine.
      if (clubId) {
        query = query.eq('club_id', clubId);
      } else if (auth.clubId) {
        query = query.eq('club_id', auth.clubId);
      }

      // Additional filters
      if (action) {
        query = query.eq('action', action);
      }

      if (entityType) {
        query = query.eq('resource_type', entityType);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      // Der AuditLogViewer erwartet entity_*/user_email/changes. Die Tabelle
      // heißt resource_*/actor_id/details — hier einmal übersetzt, statt das
      // Schema an eine Komponente anzupassen.
      const logs = (data ?? []).map((row: any) => ({
        id: row.id,
        action: row.action,
        entity_type: row.resource_type,
        entity_id: row.resource_id,
        user_id: row.actor_id,
        user_email: row.actor?.email ?? row.actor?.full_name ?? 'System',
        club_id: row.club_id,
        changes: row.details ?? {},
        ip_address: row.ip_address,
        user_agent: row.user_agent,
        created_at: row.created_at,
      }));

      return NextResponse.json({
        logs,
        total: count || 0,
        limit,
        offset,
      });
    } catch (error) {
      log.error('Error fetching audit logs:', error);
      return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
    }
  });
}

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { format } from 'date-fns';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:audit-logs:export');

/**
 * @swagger
 * /api/audit-logs/export:
 *   get:
 *     summary: Export audit logs as CSV
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
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
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       401:
 *         description: Unauthorized
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    try {
      const { searchParams } = new URL(request.url);
      const clubId = searchParams.get('club_id');
      const action = searchParams.get('action');
      const entityType = searchParams.get('entity_type');

      const supabase = await createClient();

      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10000); // Max 10k rows for export

      if (action) query = query.eq('action', action);
      // Filter by club if specified
      if (clubId) {
        // For audit logs, we need to filter by resource_type and resource_id
        query = query.eq('resource_type', 'club').eq('resource_id', clubId);
      } else if (auth.clubId) {
        query = query.eq('resource_type', 'club').eq('resource_id', auth.clubId);
      }

      if (action) query = query.eq('action', action);
      if (entityType) query = query.eq('resource_type', entityType);

      const { data, error } = await query;

      if (error) throw error;

      // Generate CSV
      const headers = [
        'Timestamp',
        'Action',
        'Entity Type',
        'Entity ID',
        'User Email',
        'IP Address',
        'Changes',
      ];
      const rows = (data || []).map((log: any) => [
        format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
        log.action,
        log.entity_type,
        log.entity_id,
        log.user_email || '',
        log.ip_address || '',
        JSON.stringify(log.changes || {}),
      ]);

      const csv = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
        },
      });
    } catch (error) {
      log.error('Error exporting audit logs:', error);
      return NextResponse.json({ error: 'Failed to export audit logs' }, { status: 500 });
    }
  });
}

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
      return forbiddenResponse('Zugriff nur für Admins');
    }

    try {
      const { searchParams } = new URL(request.url);
      const clubId = searchParams.get('club_id');
      const action = searchParams.get('action');
      const entityType = searchParams.get('entity_type');

      const supabase = await createClient();

      let query = supabase
        .from('audit_logs')
        .select('*, actor:actor_id(email)')
        .order('created_at', { ascending: false })
        .limit(10000); // Max 10k rows for export

      // Vereins-Filter über club_id (siehe Kommentar in ../route.ts).
      if (clubId) {
        query = query.eq('club_id', clubId);
      } else if (auth.clubId) {
        query = query.eq('club_id', auth.clubId);
      }

      if (action) query = query.eq('action', action);
      if (entityType) query = query.eq('resource_type', entityType);

      const { data, error } = await query;

      if (error) throw error;

      // CSV — Spalten müssen der Tabelle entsprechen. Vorher standen hier
      // entity_type/entity_id/user_email/changes; die Spalten existieren nicht,
      // der Export lieferte vier leere Spalten.
      const headers = [
        'Zeitpunkt',
        'Aktion',
        'Objekttyp',
        'Objekt-ID',
        'Akteur',
        'Verein',
        'IP-Adresse',
        'Details',
      ];
      const rows = (data || []).map((row: any) => [
        format(new Date(row.created_at), 'yyyy-MM-dd HH:mm:ss'),
        row.action,
        row.resource_type,
        row.resource_id,
        row.actor?.email ?? row.actor_id ?? '',
        row.club_id ?? '',
        row.ip_address || '',
        JSON.stringify(row.details ?? {}),
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
      return NextResponse.json(
        { error: 'Audit-Logs konnten nicht exportiert werden' },
        { status: 500 }
      );
    }
  });
}

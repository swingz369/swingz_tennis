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
      return forbiddenResponse('Admin access required');
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
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Filter by club if provided
      if (clubId) {
        // For audit logs, we need to filter by resource_type and resource_id
        query = query.eq('resource_type', 'club').eq('resource_id', clubId);
      } else if (auth.clubId) {
        // If no club_id provided, filter by user's club
        query = query.eq('resource_type', 'club').eq('resource_id', auth.clubId);
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

      return NextResponse.json({
        logs: data || [],
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

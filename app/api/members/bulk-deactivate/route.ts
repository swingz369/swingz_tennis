import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/infrastructure/external/supabase/server';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:members:bulk-deactivate');

const bulkDeactivateSchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1).max(100),
  reason: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    // Only admins can bulk deactivate
    if (auth.role !== 'admin' && auth.role !== 'superadmin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Rate limit: strict (10 requests per minute)
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);

    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await request.json();
      const validation = bulkDeactivateSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid request', details: validation.error.errors },
          { status: 400 }
        );
      }

      const { memberIds, reason } = validation.data;
      const supabase = await createClient();

      // Deactivate memberships (soft delete)
      if (!auth.clubId) {
        return NextResponse.json({ error: 'Club ID required' }, { status: 400 });
      }
      const clubId = auth.clubId;
      const { data: deactivated, error } = await supabase
        .from('user_club_memberships')
        .update({
          is_active: false,
          deactivated_at: new Date().toISOString(),
          deactivated_by: auth.user.id,
          deactivation_reason: reason ?? null,
        } as any)
        .in('user_id', memberIds)
        .eq('club_id', clubId)
        .select('id, user_id');

      if (error) {
        log.error('Bulk deactivation error:', error);
        return NextResponse.json({ error: 'Failed to deactivate members' }, { status: 500 });
      }

      // Audit log each deactivation
      if (deactivated && deactivated.length > 0) {
        const auditEntries = deactivated.map((entry) => ({
          user_id: auth.user.id,
          action: 'member_bulk_deactivated',
          resource_type: 'member',
          resource_id: entry.user_id,
          metadata: { reason, bulk: true, count: deactivated.length },
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          user_agent: request.headers.get('user-agent'),
          created_at: new Date().toISOString(),
        }));

        await supabase.from('audit_logs').insert(auditEntries as any);
      }

      return NextResponse.json({
        success: true,
        count: deactivated?.length || 0,
        message: `${deactivated?.length || 0} members deactivated successfully`,
      });
    } catch (error) {
      log.error('Bulk deactivate error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

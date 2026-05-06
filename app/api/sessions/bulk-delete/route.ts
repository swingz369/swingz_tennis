import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/infrastructure/external/supabase/server';
import { z } from 'zod';

const bulkDeleteSchema = z.object({
  sessionIds: z.array(z.string().uuid()).min(1).max(50),
  reason: z.string().optional(),
});

export async function DELETE(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    // Only admins and trainers can bulk delete sessions
    if (auth.role !== 'admin' && auth.role !== 'superadmin' && auth.role !== 'trainer') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Rate limit: strict (10 requests per minute)
    const rateLimitError = await checkRateLimitOrFail(request, RATE_LIMITS.STRICT);

    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await request.json();
      const validation = bulkDeleteSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid request', details: validation.error.errors },
          { status: 400 }
        );
      }

      const { sessionIds, reason } = validation.data;
      const supabase = await createClient();

      // Trainers can only delete their own sessions
      const query = supabase.from('sessions').delete().in('id', sessionIds);

      if (auth.role === 'trainer') {
        // Verify trainer owns these sessions
        const { data: sessions } = await supabase
          .from('sessions')
          .select('id, trainer_id')
          .in('id', sessionIds);

        const trainerProfileResult = await supabase
          .from('trainer_profiles')
          .select('id')
          .eq('user_id', auth.user.id)
          .single();

        if (sessions && trainerProfileResult.data) {
          const ownedSessions = sessions.filter(
            (s) => s.trainer_id === trainerProfileResult.data.id
          );

          if (ownedSessions.length !== sessions.length) {
            return NextResponse.json(
              { error: 'Cannot delete sessions owned by other trainers' },
              { status: 403 }
            );
          }
        }
      }

      const { data: deleted, error } = await query.select('id');

      if (error) {
        console.error('Bulk delete sessions error:', error);
        return NextResponse.json({ error: 'Failed to delete sessions' }, { status: 500 });
      }

      // Audit log
      if (deleted && deleted.length > 0) {
        await supabase.from('audit_logs').insert({
          user_id: auth.user.id,
          action: 'session_bulk_deleted',
          resource_type: 'session',
          resource_id: null,
          metadata: { reason, count: deleted.length, sessionIds },
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          user_agent: request.headers.get('user-agent'),
          created_at: new Date().toISOString(),
        });
      }

      return NextResponse.json({
        success: true,
        count: deleted?.length || 0,
        message: `${deleted?.length || 0} sessions deleted successfully`,
      });
    } catch (error) {
      console.error('Bulk delete sessions error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

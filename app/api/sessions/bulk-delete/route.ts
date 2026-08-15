import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole } from '@/lib/api-auth';
import { checkRateLimitOrFail, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/infrastructure/external/supabase/server';
import { logAudit } from '@/lib/audit';
import { z } from 'zod';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:sessions:bulk-delete');

const bulkDeleteSchema = z.object({
  sessionIds: z.array(z.string().uuid()).min(1).max(50),
  reason: z.string().optional(),
});

export async function DELETE(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    // Only admins and trainers can bulk delete sessions
    if (!(await verifyRole(auth, 'trainer'))) {
      return NextResponse.json({ error: 'Unzureichende Berechtigungen' }, { status: 403 });
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
          { error: 'Ungültige Anfrage', details: validation.error.errors },
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
              { error: 'Sessions anderer Trainer können nicht gelöscht werden' },
              { status: 403 }
            );
          }
        }
      }

      const { data: deleted, error } = await query.select('id');

      if (error) {
        log.error('Bulk delete sessions error:', error);
        return NextResponse.json(
          { error: 'Sessions konnten nicht gelöscht werden' },
          { status: 500 }
        );
      }

      // Audit log — one row per deleted session (resource_id is NOT NULL)
      if (deleted && deleted.length > 0) {
        await logAudit(
          deleted.map((s) => ({
            actorId: auth.user.id,
            action: 'session_bulk_deleted',
            resourceType: 'session',
            resourceId: s.id,
            clubId: auth.clubId,
            details: { reason, count: deleted.length },
            request,
          }))
        );
      }

      return NextResponse.json({
        success: true,
        count: deleted?.length || 0,
        message: `${deleted?.length || 0} sessions deleted successfully`,
      });
    } catch (error) {
      log.error('Bulk delete sessions error:', error);
      return internalErrorResponse();
    }
  });
}

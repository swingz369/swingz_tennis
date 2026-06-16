import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { withCSRFProtection } from '@/lib/csrf';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:users:superadmin-setup');

/**
 * POST /api/users/superadmin-setup
 * Marks the superadmin onboarding as complete for the current user.
 * Only callable by superadmins.
 */
export async function POST(request: NextRequest) {
  return withCSRFProtection(request, async () => {
    return withApiAuth(request, async (auth) => {
      try {
        const isSuperadmin = await verifyRole(auth, 'superadmin');
        if (!isSuperadmin) {
          return forbiddenResponse('Only superadmins can complete superadmin setup');
        }

        const { data: user, error: fetchError } = await auth.supabase
          .from('users')
          .select('id, superadmin_setup_completed_at')
          .eq('id', auth.user.id)
          .maybeSingle();

        if (fetchError || !user) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (user.superadmin_setup_completed_at) {
          return NextResponse.json({ already_completed: true });
        }

        const { error: updateError } = await auth.supabase
          .from('users')
          .update({ superadmin_setup_completed_at: new Date().toISOString() })
          .eq('id', auth.user.id);

        if (updateError) {
          log.error('superadmin-setup update error:', updateError);
          return NextResponse.json(
            { error: updateError.message || 'Failed to update' },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        log.error('superadmin-setup error:', error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Internal error' },
          { status: 500 }
        );
      }
    });
  });
}

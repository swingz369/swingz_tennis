import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:user:delete');

export async function DELETE(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const { user, clubId } = auth;
    const serviceSb = createServiceClient();

    try {
      // Anonymize personal data instead of hard-delete (preserves accounting records)
      await serviceSb
        .from('users')
        .update({
          full_name: 'Gelöschter Nutzer',
          email: `deleted-${user.id}@deleted.invalid`,
          phone: null,
          address: null,
          city: null,
          postal_code: null,
          date_of_birth: null,
          bio: null,
          emergency_contact: null,
          avatar_url: null,
        })
        .eq('id', user.id);

      // Deactivate membership
      if (clubId) {
        await serviceSb
          .from('user_club_memberships')
          .update({ is_active: false })
          .eq('user_id', user.id)
          .eq('club_id', clubId);
      }

      // Delete auth user (this invalidates all sessions)
      const { error } = await serviceSb.auth.admin.deleteUser(user.id);
      if (error) {
        log.error('Auth user deletion failed', error);
        return NextResponse.json({ error: 'Löschung fehlgeschlagen' }, { status: 500 });
      }

      log.info('User account deleted (DSGVO)', { userId: user.id });
      return NextResponse.json({ success: true });
    } catch (err) {
      log.error('Account deletion error', err instanceof Error ? err : undefined);
      return NextResponse.json({ error: 'Löschung fehlgeschlagen' }, { status: 500 });
    }
  });
}

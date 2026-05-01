import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';
import { updateMemberSchema } from '@/application/validation/schemas';
import { withValidation } from '@/application/validation/validator';
import { AuditService } from '@/infrastructure/audit/audit.service';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return withValidation(updateMemberSchema, async (input) => {
    try {
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!user || authError) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Check if actor is admin/superadmin
      const { data: actorMemberships } = await supabase
        .from('user_club_memberships')
        .select('role')
        .eq('user_id', user.id)
        .limit(1);

      const isAdmin = actorMemberships?.some(
        (m: { role: string }) => m.role === 'admin' || m.role === 'superadmin'
      );
      if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // Get membership and its user_id
      const { data: membership, error: membershipError } = await supabase
        .from('user_club_memberships')
        .select('user_id')
        .eq('id', id)
        .single();

      if (membershipError || !membership) {
        return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
      }

      // Prepare updates for membership table
      const membershipUpdates: Record<string, boolean | string> = {};
      if (input.is_active !== undefined) membershipUpdates.is_active = input.is_active;
      if (input.role !== undefined) membershipUpdates.role = input.role;

      // Update membership
      if (Object.keys(membershipUpdates).length > 0) {
        const { error: updateError } = await supabase
          .from('user_club_memberships')
          .update(membershipUpdates)
          .eq('id', id);

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 400 });
        }
      }

      // Update user's full_name if provided
      if (input.full_name !== undefined) {
        const { error: userUpdateError } = await supabase
          .from('users')
          .update({ full_name: input.full_name })
          .eq('id', membership.user_id);

        if (userUpdateError) {
          console.warn('Failed to update user full_name:', userUpdateError.message);
        }
      }

      // Audit log
      try {
        await AuditService.logMemberUpdated(user.id, membership.user_id, input);
      } catch (auditError) {
        console.warn('Audit log failed:', auditError);
      }

      return NextResponse.json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error updating member:', err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  })(req);
}

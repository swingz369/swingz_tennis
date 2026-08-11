import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { memberService } from '@/src/application/services/member-service.adapter';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:members:[id]');

// Service role client for updating the users table (bypasses RLS)
const serviceClient = createServiceClient();

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiAuth(_request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Authentication required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;

      const isTrainer = await verifyRole(auth, 'trainer');
      const { data: membership } = await auth.supabase
        .from('user_club_memberships')
        .select('user_id')
        .eq('id', id)
        .single();

      if (!isTrainer && membership?.user_id !== auth.user.id) {
        return forbiddenResponse('Access denied');
      }

      const member = await memberService.getMemberById(id);

      // A4: DSGVO Read-Audit (Art. 5 Abs. 2) — non-blocking
      void (serviceClient as any).from('audit_logs').insert({
        action: 'READ_MEMBER',
        table_name: 'users',
        record_id: id,
        performed_by: auth.user.id,
        details: { club_id: auth.clubId },
      });

      if (!member) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }

      return NextResponse.json({ member });
    } catch (error) {
      log.error('Member fetch error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    // Only trainers and admins can update members
    const hasPermission = await verifyRole(auth, 'trainer');
    if (!hasPermission) {
      return forbiddenResponse('Trainer or admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;
      const body = await _request.json();

      const {
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth,
        address,
        city,
        postalCode,
        bio,
        memberType,
        membershipStatus,
        membershipStart,
        membershipEnd,
        trainingGroup,
        emergencyContact,
        emergencyPhone,
        notes,
        is_active,
        role,
        include_in_planning,
        joinedAt,
      } = body;

      if (joinedAt !== undefined && joinedAt !== null && !/^\d{4}-\d{2}-\d{2}$/.test(joinedAt)) {
        return NextResponse.json({ error: 'Ungültiges Beitrittsdatum' }, { status: 400 });
      }

      // Update in-memory service (backward compatibility)
      const updated = await memberService.updateMember(id, {
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth,
        address,
        memberType,
        membershipStatus,
        membershipStart,
        membershipEnd,
        trainingGroup,
        emergencyContact,
        notes,
      });

      if (!updated) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }

      // Persist profile fields to Supabase users table
      // Get the user_id from the membership first
      const { data: membership } = await auth.supabase
        .from('user_club_memberships')
        .select('user_id')
        .eq('id', id)
        .single();

      // E-Mail-Änderung betrifft den Auth-Login — nur Admins dürfen das.
      if (email !== undefined) {
        const isAdmin = await verifyRole(auth, 'admin');
        if (!isAdmin) {
          return forbiddenResponse('Admin-Zugriff erforderlich für E-Mail-Änderung');
        }
        if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return NextResponse.json({ error: 'Ungültige E-Mail-Adresse' }, { status: 400 });
        }
      }

      if (membership?.user_id) {
        if (email !== undefined) {
          const { error: authEmailError } = await serviceClient.auth.admin.updateUserById(
            membership.user_id,
            { email }
          );
          if (authEmailError) {
            log.error('Failed to update auth email:', authEmailError);
            return NextResponse.json(
              { error: authEmailError.message || 'E-Mail-Änderung fehlgeschlagen' },
              { status: 409 }
            );
          }
        }

        // Build update payload with only non-undefined fields
        const userUpdate: Record<string, unknown> = {};
        if (email !== undefined) userUpdate.email = email;
        if (phone !== undefined) userUpdate.phone = phone;
        if (address !== undefined) userUpdate.address = address;
        if (city !== undefined) userUpdate.city = city;
        if (postalCode !== undefined) userUpdate.postal_code = postalCode;
        if (dateOfBirth !== undefined) userUpdate.date_of_birth = dateOfBirth;
        if (bio !== undefined) userUpdate.bio = bio;
        if (emergencyContact !== undefined) userUpdate.emergency_contact = emergencyContact;
        if (emergencyPhone !== undefined) userUpdate.emergency_phone = emergencyPhone;

        if (Object.keys(userUpdate).length > 0) {
          const { error: userUpdateError } = await serviceClient
            .from('users')
            .update(userUpdate)
            .eq('id', membership.user_id);

          if (userUpdateError) {
            log.error('Failed to update user profile:', userUpdateError);
          }
        }
      }

      // Also update membership fields (is_active, role, include_in_planning) on the membership table
      const membershipUpdate: any = {};
      if (is_active !== undefined) membershipUpdate.is_active = is_active;
      if (role !== undefined) membershipUpdate.role = role;
      if (include_in_planning !== undefined)
        membershipUpdate.include_in_planning = include_in_planning;
      if (joinedAt !== undefined) membershipUpdate.joined_at = joinedAt;

      if (Object.keys(membershipUpdate).length > 0) {
        await auth.supabase.from('user_club_memberships').update(membershipUpdate).eq('id', id);
      }

      return NextResponse.json({ success: true, member: updated });
    } catch (error) {
      log.error('Member update error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiAuth(_request, async (auth) => {
    // Only admins can delete members
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const { id } = await params;

      // SECURITY FIX: Implement soft delete instead of hard delete
      // Get membership details first
      const { data: membership, error: fetchError } = await auth.supabase
        .from('user_club_memberships')
        .select('user_id, club_id, role')
        .eq('id', id)
        .single();

      if (fetchError || !membership) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
      }

      // Verify club access for non-superadmin
      if (auth.role !== 'superadmin' && membership.club_id !== auth.clubId) {
        return forbiddenResponse('Cannot delete members from other clubs');
      }

      // Soft delete: Deactivate membership instead of deleting
      const { error: updateError } = await auth.supabase
        .from('user_club_memberships')
        .update({
          is_active: false,
          deactivated_at: new Date().toISOString(),
          deactivated_by: auth.user.id,
        })
        .eq('id', id);

      if (updateError) {
        log.error('Error deactivating member:', updateError);
        return NextResponse.json(
          { error: 'Failed to deactivate member', details: updateError.message },
          { status: 500 }
        );
      }

      // Audit log
      try {
        await auth.supabase.from('audit_logs').insert({
          actor_id: auth.user.id,
          action: 'member_deactivated',
          resource_type: 'membership',
          resource_id: id,
          club_id: membership.club_id,
          details: {
            membership_id: id,
            user_id: membership.user_id,
            role: membership.role,
            method: 'soft_delete',
          },
          ip_address: _request.headers.get('x-forwarded-for') || _request.headers.get('x-real-ip'),
          user_agent: _request.headers.get('user-agent'),
        } as any);
      } catch (auditError) {
        log.error('Audit logging failed:', auditError);
      }

      // Notify the deactivated member
      try {
        await serviceClient.from('notifications').insert({
          user_id: membership.user_id,
          club_id: membership.club_id,
          type: 'member_deactivated',
          title: 'Mitgliedschaft deaktiviert',
          message: 'Deine Mitgliedschaft wurde deaktiviert. Bitte wende dich an den Administrator.',
          read: false,
        });
      } catch (notifyError) {
        log.error('Deactivation notification failed:', notifyError);
      }

      return NextResponse.json({
        success: true,
        message: 'Member deactivated successfully (soft delete)',
      });
    } catch (error) {
      log.error('Member delete error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

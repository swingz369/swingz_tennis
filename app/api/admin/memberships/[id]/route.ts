/**
 * Admin API - Manage user club memberships (role changes, activation)
 * SECURITY FIX: Dedicated endpoint for role management
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuth, verifyRole, forbiddenResponse, type AuthContext } from '@/lib/api-auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:admin:memberships:[id]');

type RouteContext = {
  params: Promise<{ id: string }>;
};

const ROLE_HIERARCHY = {
  owner: 5,
  superadmin: 4,
  admin: 3,
  trainer: 2,
  member: 1,
} as const;

/**
 * GET /api/admin/memberships/[id] - Get membership details
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  return withAuth(request, async (auth: AuthContext) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const { data: membership, error } = await auth.supabase
      .from('user_club_memberships')
      .select('*, users:user_id(id, email, full_name)')
      .eq('id', id)
      .single();

    if (error || !membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
    }

    // Verify club access (superadmin can access any club)
    if (auth.role !== 'superadmin' && membership.club_id !== auth.clubId) {
      return forbiddenResponse('Cannot access memberships from other clubs');
    }

    return NextResponse.json({ data: membership });
  });
}

/**
 * PATCH /api/admin/memberships/[id] - Update membership (role, is_active)
 * SECURITY: Prevents privilege escalation, enforces club boundaries
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  return withAuth(request, async (auth: AuthContext) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    try {
      const body = await request.json();
      const { role, is_active } = body;

      // Validate inputs
      if (role && !['member', 'trainer', 'admin', 'superadmin'].includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }

      if (is_active !== undefined && typeof is_active !== 'boolean') {
        return NextResponse.json({ error: 'Invalid is_active value' }, { status: 400 });
      }

      // Get current membership
      const { data: currentMembership, error: fetchError } = await auth.supabase
        .from('user_club_memberships')
        .select('*, users:user_id(email, full_name)')
        .eq('id', id)
        .single();

      if (fetchError || !currentMembership) {
        return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
      }

      // Security: Verify club access (non-superadmin can only modify own club)
      if (auth.role !== 'superadmin' && currentMembership.club_id !== auth.clubId) {
        return forbiddenResponse('Cannot modify memberships from other clubs');
      }

      // Security: Prevent privilege escalation
      // Only superadmin can assign superadmin role
      if (role === 'superadmin' && auth.role !== 'superadmin') {
        return forbiddenResponse('Only superadmin can assign superadmin role');
      }

      // Security: Cannot demote higher-ranking users
      if (
        role &&
        ROLE_HIERARCHY[currentMembership.role as keyof typeof ROLE_HIERARCHY] >
          ROLE_HIERARCHY[auth.role]
      ) {
        return forbiddenResponse('Cannot modify users with higher privileges');
      }

      // Security: Cannot promote to higher than your own role
      if (role && ROLE_HIERARCHY[role as keyof typeof ROLE_HIERARCHY] > ROLE_HIERARCHY[auth.role]) {
        return forbiddenResponse('Cannot promote users to higher privilege than yourself');
      }

      // Build update object
      const updates: any = {
        updated_at: new Date().toISOString(),
      };

      if (role !== undefined) {
        updates.role = role;
      }

      if (is_active !== undefined) {
        updates.is_active = is_active;
        if (!is_active) {
          updates.deactivated_at = new Date().toISOString();
          updates.deactivated_by = auth.user.id;
        } else {
          updates.deactivated_at = null;
          updates.deactivated_by = null;
        }
      }

      // Update membership
      const { data: updatedMembership, error: updateError } = await auth.supabase
        .from('user_club_memberships')
        .update(updates)
        .eq('id', id)
        .select('*, users:user_id(email, full_name)')
        .single();

      if (updateError) {
        log.error('Error updating membership:', updateError);
        return NextResponse.json(
          { error: 'Failed to update membership', details: updateError.message },
          { status: 500 }
        );
      }

      // Audit log the change
      try {
        const memberUser = Array.isArray(currentMembership.users)
          ? currentMembership.users[0]
          : currentMembership.users;
        const auditDetails: any = {
          membership_id: id,
          user_email: memberUser?.email,
          club_id: currentMembership.club_id,
          changes: {},
        };

        if (role && role !== currentMembership.role) {
          auditDetails.changes.role = {
            from: currentMembership.role,
            to: role,
          };
        }

        if (is_active !== undefined && is_active !== currentMembership.is_active) {
          auditDetails.changes.is_active = {
            from: currentMembership.is_active,
            to: is_active,
          };
        }

        // Log to audit_logs table
        await auth.supabase.from('audit_logs').insert({
          user_id: auth.user.id,
          action: role ? 'role_changed' : 'member_status_changed',
          resource_type: 'membership',
          resource_id: id,
          details: auditDetails,
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          user_agent: request.headers.get('user-agent'),
        } as any);
      } catch (auditError) {
        // Don't fail the request if audit logging fails
        log.error('Audit logging failed:', auditError);
      }

      return NextResponse.json({
        success: true,
        data: updatedMembership,
        message: role
          ? `Role updated from ${currentMembership.role} to ${role}`
          : 'Membership updated successfully',
      });
    } catch (error) {
      log.error('Error in PATCH /api/admin/memberships/[id]:', error);
      return NextResponse.json(
        {
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}

/**
 * DELETE /api/admin/memberships/[id] - Soft delete membership
 * Uses is_active flag instead of hard delete to preserve audit trail
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  return withAuth(request, async (auth: AuthContext) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    try {
      // Get current membership
      const { data: currentMembership, error: fetchError } = await auth.supabase
        .from('user_club_memberships')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !currentMembership) {
        return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
      }

      // Security: Verify club access
      if (auth.role !== 'superadmin' && currentMembership.club_id !== auth.clubId) {
        return forbiddenResponse('Cannot delete memberships from other clubs');
      }

      // Security: Cannot delete higher-ranking users
      if (
        ROLE_HIERARCHY[currentMembership.role as keyof typeof ROLE_HIERARCHY] >
        ROLE_HIERARCHY[auth.role]
      ) {
        return forbiddenResponse('Cannot delete users with higher privileges');
      }

      // Soft delete via is_active flag
      const { error: updateError } = await auth.supabase
        .from('user_club_memberships')
        .update({
          is_active: false,
          deactivated_at: new Date().toISOString(),
          deactivated_by: auth.user.id,
        })
        .eq('id', id);

      if (updateError) {
        log.error('Error deactivating membership:', updateError);
        return NextResponse.json(
          { error: 'Failed to deactivate membership', details: updateError.message },
          { status: 500 }
        );
      }

      // Audit log
      try {
        await auth.supabase.from('audit_logs').insert({
          user_id: auth.user.id,
          action: 'member_deactivated',
          resource_type: 'membership',
          resource_id: id,
          details: {
            membership_id: id,
            user_id: currentMembership.user_id,
            club_id: currentMembership.club_id,
            role: currentMembership.role,
          },
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          user_agent: request.headers.get('user-agent'),
        } as any);
      } catch (auditError) {
        log.error('Audit logging failed:', auditError);
      }

      return NextResponse.json({
        success: true,
        message: 'Membership deactivated successfully',
      });
    } catch (error) {
      log.error('Error in DELETE /api/admin/memberships/[id]:', error);
      return NextResponse.json(
        {
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  });
}

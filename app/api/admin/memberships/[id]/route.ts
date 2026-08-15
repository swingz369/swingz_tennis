/**
 * Admin API - Manage user club memberships (role changes, activation)
 * SECURITY FIX: Dedicated endpoint for role management
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse, type AuthContext } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';
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
  return withApiAuth(request, async (auth: AuthContext) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const { data: membership, error } = await auth.supabase
      .from('user_club_memberships')
      .select('*, users:user_id(id, email, full_name)')
      .eq('id', id)
      .single();

    if (error || !membership) {
      return NextResponse.json({ error: 'Mitgliedschaft nicht gefunden' }, { status: 404 });
    }

    // Verify club access (superadmin can access any club)
    if (auth.role !== 'superadmin' && membership.club_id !== auth.clubId) {
      return forbiddenResponse('Kein Zugriff auf Mitgliedschaften anderer Vereine');
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

  return withApiAuth(request, async (auth: AuthContext) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    try {
      const body = await request.json();
      const { role, is_active, is_honorary, honorary_since } = body;

      // Validate inputs
      if (role && !['member', 'trainer', 'admin', 'superadmin'].includes(role)) {
        return NextResponse.json({ error: 'Ungültige Rolle' }, { status: 400 });
      }

      if (is_active !== undefined && typeof is_active !== 'boolean') {
        return NextResponse.json({ error: 'Ungültiger Wert für is_active' }, { status: 400 });
      }

      // Get current membership
      const { data: currentMembership, error: fetchError } = await auth.supabase
        .from('user_club_memberships')
        .select('*, users:user_id(email, full_name)')
        .eq('id', id)
        .single();

      if (fetchError || !currentMembership) {
        return NextResponse.json({ error: 'Mitgliedschaft nicht gefunden' }, { status: 404 });
      }

      // Security: Verify club access (non-superadmin can only modify own club)
      if (auth.role !== 'superadmin' && currentMembership.club_id !== auth.clubId) {
        return forbiddenResponse('Mitgliedschaften anderer Vereine können nicht geändert werden');
      }

      // Security: Prevent privilege escalation
      // Only superadmin can assign superadmin role
      if (role === 'superadmin' && auth.role !== 'superadmin') {
        return forbiddenResponse('Nur ein Superadmin kann die Superadmin-Rolle vergeben');
      }

      // Security: Cannot demote higher-ranking users
      if (
        role &&
        ROLE_HIERARCHY[currentMembership.role as keyof typeof ROLE_HIERARCHY] >
          ROLE_HIERARCHY[auth.role]
      ) {
        return forbiddenResponse('Benutzer mit höheren Rechten können nicht geändert werden');
      }

      // Security: Cannot promote to higher than your own role
      if (role && ROLE_HIERARCHY[role as keyof typeof ROLE_HIERARCHY] > ROLE_HIERARCHY[auth.role]) {
        return forbiddenResponse(
          'Benutzer können nicht auf ein höheres Recht als das eigene befördert werden'
        );
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

      if (is_honorary !== undefined) {
        updates.is_honorary = is_honorary;
        updates.honorary_since = is_honorary
          ? (honorary_since ?? new Date().toISOString().slice(0, 10))
          : null;
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
        return internalErrorResponse();
      }

      // Audit log the change
      {
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

        await logAudit({
          actorId: auth.user.id,
          action: role ? 'role_changed' : 'member_status_changed',
          resourceType: 'membership',
          resourceId: id,
          clubId: currentMembership.club_id,
          details: auditDetails,
          request,
        });
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
      return internalErrorResponse();
    }
  });
}

/**
 * DELETE /api/admin/memberships/[id] - Soft delete membership
 * Uses is_active flag instead of hard delete to preserve audit trail
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  return withApiAuth(request, async (auth: AuthContext) => {
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    try {
      // Get current membership
      const { data: currentMembership, error: fetchError } = await auth.supabase
        .from('user_club_memberships')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !currentMembership) {
        return NextResponse.json({ error: 'Mitgliedschaft nicht gefunden' }, { status: 404 });
      }

      // Security: Verify club access
      if (auth.role !== 'superadmin' && currentMembership.club_id !== auth.clubId) {
        return forbiddenResponse('Mitgliedschaften anderer Vereine können nicht gelöscht werden');
      }

      // Security: Cannot delete higher-ranking users
      if (
        ROLE_HIERARCHY[currentMembership.role as keyof typeof ROLE_HIERARCHY] >
        ROLE_HIERARCHY[auth.role]
      ) {
        return forbiddenResponse('Benutzer mit höheren Rechten können nicht gelöscht werden');
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
        return internalErrorResponse();
      }

      // Audit log
      await logAudit({
        actorId: auth.user.id,
        action: 'member_deactivated',
        resourceType: 'membership',
        resourceId: id,
        clubId: currentMembership.club_id,
        details: {
          membership_id: id,
          user_id: currentMembership.user_id,
          role: currentMembership.role,
        },
        request,
      });

      return NextResponse.json({
        success: true,
        message: 'Mitgliedschaft erfolgreich deaktiviert',
      });
    } catch (error) {
      log.error('Error in DELETE /api/admin/memberships/[id]:', error);
      return internalErrorResponse();
    }
  });
}

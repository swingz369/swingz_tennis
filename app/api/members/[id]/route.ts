import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';
import { updateMemberSchema } from '@/application/validation/schemas';
import { withValidation } from '@/application/validation/validator';
import { EmailService } from '@/infrastructure/email/email.service';
import { AuditService } from '@/infrastructure/audit/audit.service';

// GET /api/members/:id – Member profile
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Authorization: users can view their own profile; admin/trainer can view any member in their clubs
  const isOwnProfile = user.id === id;

  // Fetch member's club memberships
  const { data: membershipsData } = await supabase
    .from('user_club_memberships')
    .select('club_id, role, joined_at, is_active')
    .eq('user_id', id);

  const memberships = membershipsData as Array<{
    club_id: string;
    role: string;
    joined_at: string;
    is_active: boolean;
  }> | null;

  if (!memberships || memberships.length === 0) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  // If not own profile, check if requesting user is admin/trainer in one of the member's clubs
  if (!isOwnProfile) {
    const { data: requesterMembershipsData } = await supabase
      .from('user_club_memberships')
      .select('role')
      .eq('user_id', user.id);

    const requesterMemberships = requesterMembershipsData as Array<{ role: string }> | null;
    const requesterRoles = requesterMemberships?.map((m) => m.role) || [];
    const isAdmin = requesterRoles.some((r) => r === 'admin' || r === 'superadmin');
    const isTrainer = requesterRoles.includes('trainer');

    // Check if they share at least one club
    const { data: requesterClubsData } = await supabase
      .from('user_club_memberships')
      .select('club_id')
      .eq('user_id', user.id);

    const requesterClubIds =
      (requesterClubsData as Array<{ club_id: string }> | null)?.map((m) => m.club_id) || [];

    const memberClubIds = memberships.map((m) => m.club_id);
    const sharesClub = requesterClubIds.some((cid) => memberClubIds.includes(cid));

    if (!isAdmin && !isTrainer && !sharesClub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Fetch user details
  const { data: userData } = await supabase
    .from('users')
    .select('id, email, full_name, created_at')
    .eq('id', id)
    .single();

  if (!userData) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Fetch bookings for this member (recent, with session info)
  const { data: bookingsData } = await supabase
    .from('bookings')
    .select(
      `
      id,
      status,
      booked_at,
      sessions (
        id,
        timeslot_start,
        timeslot_end,
        trainer_id,
        courts (name)
      )
    `
    )
    .eq('member_id', id)
    .order('booked_at', { ascending: false })
    .limit(50);

  const bookings = bookingsData as Array<{
    id: string;
    status: string;
    booked_at: string;
    sessions: {
      id: string;
      timeslot_start: string;
      timeslot_end: string;
      trainer_id: string;
      courts?: { name: string };
    } | null;
  }> | null;

  // Compute stats
  const totalBookings = bookings?.length || 0;
  const confirmedBookings = bookings?.filter((b) => b.status === 'confirmed').length || 0;
  const cancelledBookings = bookings?.filter((b) => b.status === 'cancelled').length || 0;
  const noShowBookings = bookings?.filter((b) => b.status === 'no_show').length || 0;

  // Primary club (first membership)
  const primaryClubId = memberships[0]?.club_id;

  return NextResponse.json({
    member: {
      id: userData.id,
      email: userData.email,
      fullName: userData.full_name,
      memberSince: userData.created_at,
      roles: memberships.map((m) => m.role),
      clubIds: memberships.map((m) => m.club_id),
      primaryClubId,
    },
    stats: {
      totalBookings,
      confirmed: confirmedBookings,
      cancelled: cancelledBookings,
      noShow: noShowBookings,
    },
    recentBookings: (bookings || []).map((b) => ({
      id: b.id,
      status: b.status,
      bookedAt: b.booked_at,
      session: b.sessions
        ? {
            id: b.sessions.id,
            startTime: b.sessions.timeslot_start.substring(11, 16),
            endTime: b.sessions.timeslot_end.substring(11, 16),
            trainerId: b.sessions.trainer_id,
            court: b.sessions.courts?.name || '-',
          }
        : null,
    })),
  });
}

// PATCH /api/members/:id – Update member
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return withValidation(updateMemberSchema, async (input) => {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow self-update or admin/trainer
    const isOwnProfile = user.id === id;
    if (!isOwnProfile) {
      const { data: memberships } = await supabase
        .from('user_club_memberships')
        .select('role')
        .eq('user_id', user.id);
      const roles = (memberships as Array<{ role: string }> | null)?.map((m) => m.role) || [];
      const isAuthorized = roles.some(
        (r) => r === 'admin' || r === 'superadmin' || r === 'trainer'
      );
      if (!isAuthorized) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    try {
      const updates: Record<string, unknown> = {};
      if (input.full_name !== undefined) updates.full_name = input.full_name;
      if (input.is_active !== undefined) updates.is_active = input.is_active;
      if (input.role !== undefined) updates.role = input.role;

      if (Object.keys(updates).length > 0) {
        // Fetch current member data before update for email notification
        let memberEmail: string | null = null;
        let memberName: string = 'Mitglied';
        let clubName: string = 'dein Verein';
        let oldRole: string = '';

        if (input.is_active !== undefined || input.role !== undefined) {
          const { data: memberData } = await supabase
            .from('users')
            .select('email, full_name')
            .eq('id', id)
            .single();
          if (memberData) {
            memberEmail = memberData.email;
            memberName = memberData.full_name || 'Mitglied';
          }

          // Get current role and club name
          const { data: membershipData } = await supabase
            .from('user_club_memberships')
            .select('role, clubs (name)')
            .eq('user_id', id)
            .limit(1);
          if (membershipData?.[0]) {
            oldRole = membershipData[0].role;
            if (membershipData[0].clubs) {
              clubName = (membershipData[0].clubs as { name: string }).name;
            }
          }
        }

        const { error } = await supabase.from('users').update(updates).eq('id', id);
        if (error) {
          console.error('Error updating member:', error);
          return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
        }

        // Send status change email if active status changed
        if (input.is_active !== undefined && memberEmail) {
          EmailService.sendMemberStatusUpdate(memberEmail, {
            memberName,
            clubName,
            isActive: input.is_active,
          }).catch(console.error);
        }

        // Send role change email if role changed
        if (input.role !== undefined && memberEmail && input.role !== oldRole) {
          EmailService.sendRoleChangeNotification(memberEmail, {
            memberName,
            clubName,
            oldRole,
            newRole: input.role,
          }).catch(console.error);
        }

        // Audit logs
        if (input.is_active !== undefined) {
          await AuditService.logMemberStatusChange(user.id, id, input.is_active);
        }
        if (input.full_name !== undefined) {
          await AuditService.logMemberUpdated(user.id, id, { full_name: input.full_name });
        }
        if (input.role !== undefined) {
          await AuditService.logRoleChange(user.id, id, oldRole, input.role);
        }
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error updating member:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  })(request);
}

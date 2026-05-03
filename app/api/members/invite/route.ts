import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';
import { z } from 'zod';
import { EmailService } from '@/infrastructure/email/email.service';
import { AuditService } from '@/infrastructure/audit/audit.service';

const inviteSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  full_name: z.string().min(2, 'Name muss mindestens 2 Zeichen haben'),
  role: z.enum(['member', 'trainer', 'admin']).default('member'),
  club_id: z.string().uuid('Ungültige Vereins-ID'),
});

// POST /api/members/invite – Invite a new member to a club
export async function POST(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await _request.json();
    const { email, full_name, role, club_id } = inviteSchema.parse(body);

    // Only admin/superadmin can invite, and must belong to the target club
    const { data: memberships } = await supabase
      .from('user_club_memberships')
      .select('role, club_id')
      .eq('user_id', user.id);
    const roles = (memberships as Array<{ role: string; club_id: string }> | null) || [];
    const isAuthorized = roles.some(
      (m) => (m.role === 'admin' || m.role === 'superadmin') && m.club_id === club_id
    );
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: 'Ein Benutzer mit dieser E-Mail-Adresse existiert bereits' },
        { status: 409 }
      );
    }

    // Generate a random password (user will reset via password recovery)
    const tempPassword = Math.random().toString(36).slice(-9) + 'A1!';

    // Create auth user
    const { data: newUser, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
      },
    });

    if (signUpError) {
      console.error('Error creating user:', signUpError);
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    if (!newUser.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // Add club membership
    const { error: membershipError } = await supabase.from('user_club_memberships').insert({
      user_id: newUser.user.id,
      club_id,
      role,
      is_active: true,
    });

    if (membershipError) {
      console.error('Error creating membership:', membershipError);
      // Cleanup: delete user if membership fails
      await supabase.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json({ error: 'Failed to add member to club' }, { status: 500 });
    }

    // Get club name for email
    const { data: clubData } = await supabase
      .from('clubs')
      .select('name')
      .eq('id', club_id)
      .single();
    const clubName = clubData?.name || 'dein Verein';

    // Send invite email
    EmailService.sendInvitation(email, {
      memberName: full_name,
      clubName,
      loginUrl: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
      resetPasswordUrl: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?email=${encodeURIComponent(email)}`,
    }).catch(console.error);

    // Audit log
    await AuditService.logMemberInvited(user.id, newUser.user.id, club_id, role);

    return NextResponse.json({
      success: true,
      member: {
        id: newUser.user.id,
        email,
        full_name: full_name,
        role,
        is_active: true,
        joined_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

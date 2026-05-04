import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';
import { z } from 'zod';
import { EmailService } from '@/infrastructure/email/email.service';
import { AuditService } from '@/infrastructure/audit/audit.service';
import { withApiAuth, verifyRole, forbiddenResponse, verifyClubAccess } from '@/lib/api-auth';
import { rateLimitStrict, checkRateLimitOrFail } from '@/lib/rate-limit';

const inviteSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  full_name: z.string().min(2, 'Name muss mindestens 2 Zeichen haben'),
  role: z.enum(['member', 'trainer', 'admin']).default('member'),
  club_id: z.string().uuid('Ungültige Vereins-ID'),
});

// POST /api/members/invite – Invite a new member to a club
export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Only admins can invite members
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Admin access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, rateLimitStrict);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await _request.json();
      const { email, full_name, role, club_id } = inviteSchema.parse(body);

      // Verify admin has access to target club
      const hasClubAccess = await verifyClubAccess(auth, club_id);
      if (!hasClubAccess) {
        return forbiddenResponse('No access to target club');
      }

      const supabase = await createClient();

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
      await AuditService.logMemberInvited(auth.user.id, newUser.user.id, club_id, role);

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
  });
}

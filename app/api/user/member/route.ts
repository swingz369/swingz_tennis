import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(_req: NextRequest) {
  const cookieStore = await cookies();
  const hasDemoMode = cookieStore.get('demo-mode');
  if (hasDemoMode) {
    return NextResponse.json({
      memberId: 'demo-member',
      fullName: 'Demo User',
      email: 'demo@swingz.com',
    });
  }

  return withApiAuth(_req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Member access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_req, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    // Fetch full user profile from users table
    // Note: Some columns (address, city, postal_code, bio, emergency_contact, emergency_phone, date_of_birth)
    // may not exist in the generated Database type yet — cast needed for dynamic columns
    const { data: userProfile } = await (auth.supabase as any)
      .from('users')
      .select(
        'id, full_name, email, phone, address, city, postal_code, bio, emergency_contact, emergency_phone, date_of_birth'
      )
      .eq('id', auth.user.id)
      .maybeSingle();

    return NextResponse.json({
      memberId: auth.user.id,
      fullName: userProfile?.full_name || auth.user.user_metadata?.full_name || '',
      email: userProfile?.email || auth.user.email || '',
      phone: userProfile?.phone || '',
      address: userProfile?.address || '',
      city: userProfile?.city || '',
      postalCode: userProfile?.postal_code || '',
      bio: userProfile?.bio || '',
      emergencyContact: userProfile?.emergency_contact || '',
      emergencyPhone: userProfile?.emergency_phone || '',
      dateOfBirth: userProfile?.date_of_birth || '',
    });
  });
}

export async function PATCH(_req: NextRequest) {
  return withApiAuth(_req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Member access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_req, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await _req.json();
      const { fullName, phone, address, city, postalCode, bio, emergencyContact, emergencyPhone } =
        body;

      const updateData: Record<string, string | null> = {};
      if (fullName !== undefined) updateData.full_name = fullName;
      if (phone !== undefined) updateData.phone = phone;
      if (address !== undefined) updateData.address = address;
      if (city !== undefined) updateData.city = city;
      if (postalCode !== undefined) updateData.postal_code = postalCode;
      if (bio !== undefined) updateData.bio = bio;
      if (emergencyContact !== undefined) updateData.emergency_contact = emergencyContact;
      if (emergencyPhone !== undefined) updateData.emergency_phone = emergencyPhone;

      const { error } = await (auth.supabase as any)
        .from('users')
        .update(updateData)
        .eq('id', auth.user.id);

      if (error) {
        console.error('Profile update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Profile PATCH error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

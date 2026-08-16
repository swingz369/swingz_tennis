import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:user:member');

export async function GET(_req: NextRequest) {
  return withApiAuth(_req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Mitglieder');
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
        'id, full_name, email, phone, address, city, postal_code, bio, emergency_contact, emergency_phone, date_of_birth, avatar_url, dtb_id'
      )
      .eq('id', auth.user.id)
      .maybeSingle();

    // Trainingskosten-Schätzung für member-billing: Preis pro Session ergibt
    // sich aus der Fee-Configuration des Mitglieds (amount × billing_unit_count),
    // nicht mehr aus dem früheren globalen Vereins-Stundenpreis.
    let trainingFeePerSession = 0;
    if (auth.clubId) {
      const { data: membership } = await (auth.supabase as any)
        .from('user_club_memberships')
        .select('fee_configuration_id, fee_configurations(amount, billing_unit_count)')
        .eq('user_id', auth.user.id)
        .eq('club_id', auth.clubId)
        .eq('is_active', true)
        .maybeSingle();
      const feeConfig = membership?.fee_configurations;
      const amount = Number(feeConfig?.amount ?? 0);
      const units = Number(feeConfig?.billing_unit_count ?? 1);
      trainingFeePerSession = amount * units;
    }

    return NextResponse.json({
      memberId: auth.user.id,
      fullName: userProfile?.full_name || auth.user.user_metadata?.full_name || '',
      email: userProfile?.email || auth.user.email || '',
      avatarUrl: userProfile?.avatar_url || null,
      phone: userProfile?.phone || '',
      address: userProfile?.address || '',
      city: userProfile?.city || '',
      postalCode: userProfile?.postal_code || '',
      bio: userProfile?.bio || '',
      emergencyContact: userProfile?.emergency_contact || '',
      emergencyPhone: userProfile?.emergency_phone || '',
      dateOfBirth: userProfile?.date_of_birth || '',
      dtbId: userProfile?.dtb_id || '',
      trainingFeePerSession,
    });
  });
}

export async function PATCH(_req: NextRequest) {
  return withApiAuth(_req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Mitglieder');
    }

    const rateLimitError = await checkRateLimitOrFail(_req, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    try {
      const body = await _req.json();
      const {
        fullName,
        phone,
        address,
        city,
        postalCode,
        bio,
        emergencyContact,
        emergencyPhone,
        dtbId,
      } = body;

      const updateData: Record<string, string | null> = {};
      if (fullName !== undefined) updateData.full_name = fullName;
      if (phone !== undefined) updateData.phone = phone;
      if (address !== undefined) updateData.address = address;
      if (city !== undefined) updateData.city = city;
      if (postalCode !== undefined) updateData.postal_code = postalCode;
      if (bio !== undefined) updateData.bio = bio;
      if (emergencyContact !== undefined) updateData.emergency_contact = emergencyContact;
      if (emergencyPhone !== undefined) updateData.emergency_phone = emergencyPhone;
      if (dtbId !== undefined) updateData.dtb_id = dtbId || null;

      const { error } = await (auth.supabase as any)
        .from('users')
        .update(updateData)
        .eq('id', auth.user.id);

      if (error) {
        log.error('Profile update error:', error);
        return internalErrorResponse();
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      log.error('Profile PATCH error:', error);
      return internalErrorResponse();
    }
  });
}

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(_req: NextRequest) {
  return withApiAuth(_req, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Member access required');
    }

    const rateLimitError = await checkRateLimitOrFail(_req, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    const { data: memberships, error: membershipError } = await auth.supabase
      .from('user_club_memberships')
      .select(
        'club_id, clubs (id, name, max_members, default_hourly_rate, status, bundesland, billing_unit_minutes, tax_rate, default_payment_method, invoice_number_prefix)'
      )
      .eq('user_id', auth.user.id)
      .eq('is_active', true)
      .limit(1);

    if (membershipError || !memberships || memberships.length === 0) {
      return NextResponse.json({ error: 'No club membership found' }, { status: 404 });
    }

    const membership = memberships[0];
    const club = membership.clubs as unknown as {
      id: string;
      name: string;
      max_members: number;
      default_hourly_rate: number;
      status: string;
      bundesland: string | null;
      billing_unit_minutes: number | null;
      tax_rate: number | null;
      default_payment_method: string | null;
      invoice_number_prefix: string | null;
    };
    return NextResponse.json({
      clubId: membership.club_id,
      club: {
        id: club.id,
        name: club.name,
        maxMembers: club.max_members,
        defaultHourlyRate: club.default_hourly_rate || 15.0,
        status: club.status,
        bundesland: club.bundesland ?? null,
        billingUnitMinutes: club.billing_unit_minutes ?? 60,
        taxRate: club.tax_rate ?? 0,
        defaultPaymentMethod: club.default_payment_method ?? 'transfer',
        invoicePrefix: club.invoice_number_prefix ?? '',
      },
    });
  });
}

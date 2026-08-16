import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

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

    // Use auth.clubId which respects ADMIN_CLUB_COOKIE (same as Server Components).
    // Previously this route queried user_club_memberships with limit(1), returning
    // an arbitrary club. That caused 403s when the client used the wrong clubId
    // for subsequent calls to /api/clubs/${id}/features etc.
    const targetClubId = auth.clubId;
    if (!targetClubId) {
      return NextResponse.json({ error: 'Kein Club-Kontext verfügbar' }, { status: 404 });
    }

    const { data: clubRows, error: clubError } = await auth.supabase
      .from('clubs')
      .select(
        'id, name, max_members, status, bundesland, billing_unit_minutes, tax_rate, default_payment_method, invoice_number_prefix, opening_hours'
      )
      .eq('id', targetClubId)
      .limit(1);

    if (clubError || !clubRows || clubRows.length === 0) {
      return NextResponse.json({ error: 'Verein nicht gefunden' }, { status: 404 });
    }

    const club = clubRows[0] as unknown as {
      id: string;
      name: string;
      max_members: number;
      status: string;
      bundesland: string | null;
      billing_unit_minutes: number | null;
      tax_rate: number | null;
      default_payment_method: string | null;
      invoice_number_prefix: string | null;
      opening_hours: unknown;
    };
    return NextResponse.json({
      clubId: targetClubId,
      club: {
        id: club.id,
        name: club.name,
        maxMembers: club.max_members,
        status: club.status,
        bundesland: club.bundesland ?? null,
        billingUnitMinutes: club.billing_unit_minutes ?? 60,
        taxRate: club.tax_rate ?? 0,
        defaultPaymentMethod: club.default_payment_method ?? 'transfer',
        invoicePrefix: club.invoice_number_prefix ?? '',
        openingHours: club.opening_hours ?? null,
      },
    });
  });
}

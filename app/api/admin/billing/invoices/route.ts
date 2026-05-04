import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, checkRateLimitOrFail } from '@/lib/rate-limit';

// GET /api/admin/billing/invoices – Alle Rechnungen (SuperAdmin only)
export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Rate limiting
    const rateLimitError = await checkRateLimitOrFail(_request, rateLimit);
    if (rateLimitError) return rateLimitError;

    // Permission check
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) return forbiddenResponse('Admin access required');

    try {
      // For now, return empty array until Stripe integration
      // In the future, this would join invoices table with users
      return NextResponse.json([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      console.error('Error fetching invoices:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

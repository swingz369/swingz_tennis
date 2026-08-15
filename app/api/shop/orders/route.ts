/**
 * GET /api/shop/orders
 *
 * Returns all orders for the currently authenticated member.
 * Supports optional ?status=pending|confirmed|shipped|cancelled filter.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const hasPermission = await verifyRole(auth, 'member');
    if (!hasPermission) {
      return forbiddenResponse('Anmeldung erforderlich');
    }

    const supabase = auth.supabase;
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    let query = supabase
      .from('shop_orders')
      .select('id, total_amount, status, payment_status, items, created_at')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false });

    // Normalize legacy statuses
    const VALID_STATUSES = ['pending', 'pending_payment', 'confirmed', 'shipped', 'cancelled'];

    if (statusFilter && VALID_STATUSES.includes(statusFilter)) {
      if (statusFilter === 'pending') {
        query = query.in('status', ['pending', 'pending_payment']);
      } else {
        query = query.eq('status', statusFilter);
      }
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Normalize legacy 'pending_payment' to 'pending' for the frontend
    const orders = (data ?? []).map((o: any) => ({
      ...o,
      status: o.status === 'pending_payment' ? 'pending' : o.status,
    }));

    return NextResponse.json({ orders });
  });
}

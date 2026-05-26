import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole } from '@/lib/api-auth';

/**
 * GET /api/admin/shop/orders
 * Returns global order KPI stats + orders list for the admin shop dashboard.
 * Supports ?status=pending|confirmed|shipped|cancelled filter.
 * Legacy orders with status 'pending_payment' are treated as 'pending'.
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sb = auth.supabase as any;
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    // Valid statuses (including legacy 'pending_payment' treated as 'pending')
    const VALID_STATUSES = ['pending', 'pending_payment', 'confirmed', 'shipped', 'cancelled'];

    // Non-superadmin: scope orders to club-owned products
    if (auth.role !== 'superadmin' && auth.clubId) {
      const { data: clubProducts } = await sb
        .from('shop_products')
        .select('id')
        .eq('club_id', auth.clubId);

      if (!clubProducts || clubProducts.length === 0) {
        return NextResponse.json({
          orders: [],
          total_orders: 0,
          total_revenue: 0,
          pending_orders: 0,
        });
      }

      const productIds = clubProducts.map((p: any) => p.id);

      const { data: allOrders, error } = await sb
        .from('shop_orders')
        .select('id, user_id, total_amount, status, payment_status, items, created_at');

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Client-side filter: orders containing club products
      // Normalize legacy 'pending_payment' to 'pending'
      const clubOrders = (allOrders ?? [])
        .map((o: any) => ({ ...o, status: o.status === 'pending_payment' ? 'pending' : o.status }))
        .filter((order: any) => {
          const items: any[] = order.items ?? [];
          return items.some((item: any) => productIds.includes(item.product_id));
        });

      // Calculate global stats from all orders (unfiltered by status)
      const globalStats = {
        total_orders: clubOrders.length,
        total_revenue: clubOrders.reduce((sum: number, o: any) => sum + (o.total_amount ?? 0), 0),
        pending_orders: clubOrders.filter((o: any) => o.status === 'pending').length,
      };

      // Apply status filter for the orders list
      const filteredOrders =
        statusFilter && VALID_STATUSES.includes(statusFilter)
          ? clubOrders.filter((o: any) => {
              if (statusFilter === 'pending') return o.status === 'pending';
              return o.status === statusFilter;
            })
          : clubOrders;

      return NextResponse.json({ ...globalStats, orders: filteredOrders });
    }

    // Superadmin: list all orders
    const { data: allOrders, error } = await sb
      .from('shop_orders')
      .select('id, user_id, total_amount, status, payment_status, items, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Normalize legacy 'pending_payment' to 'pending'
    const normalized = (allOrders ?? []).map((o: any) => ({
      ...o,
      status: o.status === 'pending_payment' ? 'pending' : o.status,
    }));

    // Global stats (unfiltered)
    const globalStats = {
      total_orders: normalized.length,
      total_revenue: normalized.reduce((sum: number, o: any) => sum + (o.total_amount ?? 0), 0),
      pending_orders: normalized.filter((o: any) => o.status === 'pending').length,
    };

    // Apply status filter for the orders list
    const filteredOrders =
      statusFilter && VALID_STATUSES.includes(statusFilter)
        ? normalized.filter((o: any) => {
            if (statusFilter === 'pending') return o.status === 'pending';
            return o.status === statusFilter;
          })
        : normalized;

    return NextResponse.json({ ...globalStats, orders: filteredOrders });
  });
}

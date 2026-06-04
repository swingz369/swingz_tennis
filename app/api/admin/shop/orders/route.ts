import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole } from '@/lib/api-auth';
import { buildPaginationMeta } from '@/lib/pagination';

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
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10) || 10));
    const offset = (page - 1) * limit;

    // Valid statuses (including legacy 'pending_payment' treated as 'pending')
    const VALID_STATUSES = ['pending', 'pending_payment', 'confirmed', 'shipped', 'cancelled'];

    // Helper: normalize status and apply filter
    function normalizeStatus(o: any) {
      return { ...o, status: o.status === 'pending_payment' ? 'pending' : o.status };
    }

    function matchesFilter(o: any) {
      if (!statusFilter || !VALID_STATUSES.includes(statusFilter)) return true;
      if (statusFilter === 'pending') return o.status === 'pending';
      return o.status === statusFilter;
    }

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
          pagination: buildPaginationMeta(page, limit, 0),
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
      const clubOrders = (allOrders ?? []).map(normalizeStatus).filter((order: any) => {
        const items: any[] = order.items ?? [];
        return items.some((item: any) => productIds.includes(item.product_id));
      });

      // Global stats from all club orders (unfiltered by status)
      const globalStats = {
        total_orders: clubOrders.length,
        total_revenue: clubOrders.reduce((sum: number, o: any) => sum + (o.total_amount ?? 0), 0),
        pending_orders: clubOrders.filter((o: any) => o.status === 'pending').length,
      };

      // Apply status filter + pagination
      const filteredOrders = clubOrders.filter(matchesFilter);
      const pagination = buildPaginationMeta(page, limit, filteredOrders.length);
      const paginatedOrders = filteredOrders.slice(offset, offset + limit);

      return NextResponse.json({ ...globalStats, orders: paginatedOrders, pagination });
    }

    // Superadmin: database-level pagination
    let query = sb
      .from('shop_orders')
      .select('id, user_id, total_amount, status, payment_status, items, created_at', {
        count: 'exact',
      })
      .order('created_at', { ascending: false });

    if (statusFilter && VALID_STATUSES.includes(statusFilter)) {
      // Include legacy 'pending_payment' when filtering for 'pending'
      if (statusFilter === 'pending') {
        query = query.in('status', ['pending', 'pending_payment']);
      } else {
        query = query.eq('status', statusFilter);
      }
    }

    const { data: orders, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const normalized = (orders ?? []).map(normalizeStatus);

    // For global stats we need unfiltered counts — fetch separately
    const [{ count: totalCount }, { count: pendingCount }, { data: revenueData }] =
      await Promise.all([
        sb.from('shop_orders').select('id', { count: 'exact', head: true }),
        sb
          .from('shop_orders')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'pending_payment']),
        sb.from('shop_orders').select('total_amount'),
      ]);

    const globalStats = {
      total_orders: totalCount ?? 0,
      total_revenue: (revenueData ?? []).reduce(
        (sum: number, o: any) => sum + (o.total_amount ?? 0),
        0
      ),
      pending_orders: pendingCount ?? 0,
    };

    const pagination = buildPaginationMeta(page, limit, count);

    return NextResponse.json({ ...globalStats, orders: normalized, pagination });
  });
}

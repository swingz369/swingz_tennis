import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { withApiAuth, verifyRole } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/service';
import { deleteStorageFile } from '@/lib/supabase/storage-utils';
import { buildPaginationMeta } from '@/lib/pagination';

const STORAGE_BUCKET = 'swingz-files';
const UPLOAD_PREFIX = 'shop-products';

/**
 * GET /api/admin/shop/products
 * List all shop products for the current club (admin sees active + inactive)
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }

    const sb = auth.supabase;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50));
    const offset = (page - 1) * limit;

    // Build base query with club scope
    let baseQuery = sb.from('shop_products').select('*', { count: 'exact' });
    if (auth.role !== 'superadmin' && auth.clubId) {
      baseQuery = baseQuery.eq('club_id', auth.clubId);
    }

    // Build count query with same club scope as data query
    let countQuery = sb.from('shop_products').select('id', { count: 'exact', head: true });
    if (auth.role !== 'superadmin' && auth.clubId) {
      countQuery = countQuery.eq('club_id', auth.clubId);
    }

    // Fetch paginated data + count in parallel
    const [{ data, error }, { count }] = await Promise.all([
      baseQuery
        .order('category', { ascending: true })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      countQuery,
    ]);

    if (error) {
      return internalErrorResponse();
    }

    const pagination = buildPaginationMeta(page, limit, count);

    return NextResponse.json({ products: data ?? [], pagination });
  });
}

/**
 * POST /api/admin/shop/products
 * Create a new shop product
 */
export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }

    const sb = auth.supabase;
    const body = await request.json();

    // Validate required fields
    if (!body.name || body.price == null) {
      return NextResponse.json({ error: 'Name und Preis sind erforderlich' }, { status: 400 });
    }

    const productData = {
      name: body.name,
      description: body.description || null,
      price: Number(body.price),
      category: body.category || 'Allgemein',
      stock: body.stock != null ? Number(body.stock) : 0,
      image_url: body.image_url || null,
      is_active: body.is_active ?? true,
      club_id: auth.clubId,
    };

    const { data, error } = await sb.from('shop_products').insert(productData).select().single();

    if (error) {
      return internalErrorResponse();
    }

    return NextResponse.json({ product: data }, { status: 201 });
  });
}

/**
 * PUT /api/admin/shop/products
 * Update an existing shop product
 */
export async function PUT(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }

    const sb = auth.supabase;
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Produkt-ID erforderlich' }, { status: 400 });
    }

    // Verify club ownership for non-superadmin
    if (auth.role !== 'superadmin' && auth.clubId) {
      const { data: existing } = await sb
        .from('shop_products')
        .select('club_id')
        .eq('id', body.id)
        .single();

      if (!existing || existing.club_id !== auth.clubId) {
        return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.price !== undefined) updateData.price = Number(body.price);
    if (body.category !== undefined) updateData.category = body.category;
    if (body.stock !== undefined) updateData.stock = Number(body.stock);
    if (body.image_url !== undefined) updateData.image_url = body.image_url;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    const { data, error } = await sb
      .from('shop_products')
      .update(updateData as never)
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      return internalErrorResponse();
    }

    return NextResponse.json({ product: data });
  });
}

/**
 * DELETE /api/admin/shop/products
 * Delete a shop product (query param: ?id=...)
 */
export async function DELETE(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }

    const sb = auth.supabase;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Produkt-ID erforderlich (Query-Parameter ?id=...)' },
        { status: 400 }
      );
    }

    // Verify club ownership for non-superadmin
    if (auth.role !== 'superadmin' && auth.clubId) {
      const { data: existing } = await sb
        .from('shop_products')
        .select('club_id')
        .eq('id', id)
        .single();

      if (!existing || existing.club_id !== auth.clubId) {
        return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
      }
    }

    // Fetch the product before deleting (to get image_url for storage cleanup)
    const { data: existingProduct } = await sb
      .from('shop_products')
      .select('image_url')
      .eq('id', id)
      .maybeSingle();

    const { error } = await sb.from('shop_products').delete().eq('id', id);

    if (error) {
      return internalErrorResponse();
    }

    // Clean up Storage file if the product had a Supabase Storage image
    if (existingProduct?.image_url) {
      const serviceClient = createServiceClient();
      await deleteStorageFile(
        serviceClient,
        existingProduct.image_url,
        STORAGE_BUCKET,
        UPLOAD_PREFIX
      );
    }

    return NextResponse.json({ success: true });
  });
}

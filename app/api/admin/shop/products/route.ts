import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole } from '@/lib/api-auth';

/**
 * GET /api/admin/shop/products
 * List all shop products for the current club (admin sees active + inactive)
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sb = auth.supabase as any;

    let query = sb
      .from('shop_products')
      .select('*')
      .order('category', { ascending: true })
      .order('created_at', { ascending: false });

    // Club-scope for non-superadmin
    if (auth.role !== 'superadmin' && auth.clubId) {
      query = query.eq('club_id', auth.clubId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ products: data ?? [] });
  });
}

/**
 * POST /api/admin/shop/products
 * Create a new shop product
 */
export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    if (!(await verifyRole(auth, 'admin'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sb = auth.supabase as any;
    const body = await request.json();

    // Validate required fields
    if (!body.name || body.price == null) {
      return NextResponse.json(
        { error: 'Name und Preis sind erforderlich' },
        { status: 400 }
      );
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

    const { data, error } = await sb
      .from('shop_products')
      .insert(productData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sb = auth.supabase as any;
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: 'Produkt-ID erforderlich' },
        { status: 400 }
      );
    }

    // Verify club ownership for non-superadmin
    if (auth.role !== 'superadmin' && auth.clubId) {
      const { data: existing } = await sb
        .from('shop_products')
        .select('club_id')
        .eq('id', body.id)
        .single();

      if (!existing || existing.club_id !== auth.clubId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
      .update(updateData)
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sb = auth.supabase as any;
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
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { error } = await sb.from('shop_products').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}

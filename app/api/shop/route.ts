import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuthApi } from '@/lib/auth';

// POST: Create shop order
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthApi();
    if ('error' in auth) return auth.error;
    const { supabase, user } = auth;

    const { items } = await request.json();
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Mindestens ein Artikel erforderlich' }, { status: 400 });
    }

    // Calculate total
    const { data: products } = await (supabase as any)
      .from('shop_products')
      .select('id, name, price, stock')
      .in(
        'id',
        items.map((i: any) => i.productId)
      )
      .eq('is_active', true);

    if (!products || products.length !== items.length) {
      return NextResponse.json({ error: 'Einige Produkte nicht verfügbar' }, { status: 400 });
    }

    let total = 0;
    const orderItems = items.map((item: { productId: string; quantity: number }) => {
      const product = products.find(
        (p: { id: string; name: string; price: number; stock: number }) => p.id === item.productId
      );
      if (!product) throw new Error(`Produkt ${item.productId} nicht gefunden`);
      if (product.stock < item.quantity) throw new Error(`Nicht genug Bestand für ${product.name}`);
      const itemTotal = product.price * item.quantity;
      total += itemTotal;
      return {
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: product.price,
        total: itemTotal,
      };
    });

    // Create order
    const { data: order, error } = await (supabase as any)
      .from('shop_orders')
      .insert({
        user_id: user.id,
        total_amount: total,
        status: 'pending',
        items: orderItems,
        payment_status: 'unpaid',
      })
      .select()
      .single();

    if (error) throw error;

    // Update stock
    for (const item of items) {
      await (supabase as any)
        .from('shop_products')
        .update({ stock: (supabase as any).raw(`stock - ${item.quantity}`) })
        .eq('id', item.productId)
        .gte('stock', item.quantity);
    }

    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET: List products
export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from('shop_products')
      .select('*')
      .eq('is_active', true)
      .order('category');

    if (error) throw error;

    return NextResponse.json({ products: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

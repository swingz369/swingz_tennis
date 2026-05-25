import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: List active products
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

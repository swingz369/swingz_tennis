import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import type { NextRequest } from 'next/server';
import { withApiAuth } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:shop');

// GET: List active products (requires authentication)
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (_auth) => {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('shop_products')
        .select('*')
        .eq('is_active', true)
        .order('category');

      if (error) throw error;

      return NextResponse.json({ products: data });
    } catch (error) {
      log.error('Shop products fetch error', error instanceof Error ? error : undefined);
      return internalErrorResponse();
    }
  });
}

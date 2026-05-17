import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: Validate coupon
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const code = request.nextUrl.searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'Coupon-Code erforderlich' }, { status: 400 });
    }

    const { data: coupon, error } = await (supabase as any)
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase().trim())
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    if (!coupon) {
      return NextResponse.json({ valid: false, message: 'Ungültiger Coupon-Code' });
    }

    // Check expiration
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, message: 'Coupon ist abgelaufen' });
    }

    // Check usage limit
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
      return NextResponse.json({ valid: false, message: 'Coupon-Limit erreicht' });
    }

    return NextResponse.json({
      valid: true,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      minAmount: coupon.min_amount,
      message: `${coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `€${coupon.discount_value}`} Rabatt${coupon.min_amount ? ` (Mindestbestellwert: €${coupon.min_amount})` : ''}`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create coupon (admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: membership } = await supabase
      .from('user_club_memberships')
      .select('role, club_id')
      .eq('user_id', user.id)
      .in('role', ['admin', 'superadmin'])
      .maybeSingle();

    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { code, discountType, discountValue, maxUses, expiresAt, minAmount } =
      await request.json();

    if (!code || !discountType || !discountValue) {
      return NextResponse.json(
        { error: 'Code, Rabatt-Typ und Wert erforderlich' },
        { status: 400 }
      );
    }

    const { error } = await (supabase as any).from('coupons').insert({
      club_id: membership.club_id,
      code: code.toUpperCase().trim(),
      discount_type: discountType,
      discount_value: discountValue,
      max_uses: maxUses || null,
      min_amount: minAmount || null,
      expires_at: expiresAt || null,
      created_by: user.id,
    });

    if (error) throw error;

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

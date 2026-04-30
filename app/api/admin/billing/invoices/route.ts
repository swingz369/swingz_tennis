import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';

// GET /api/admin/billing/invoices – Alle Rechnungen (SuperAdmin only)
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is superadmin
    const { data: memberships } = await supabase
      .from('user_club_memberships')
      .select('role')
      .eq('user_id', user.id);
    const roles = (memberships as Array<{ role: string }> | null)?.map((m) => m.role) || [];
    if (!roles.includes('superadmin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // For now, return empty array until Stripe integration
    // In the future, this would join invoices table with users
    return NextResponse.json([]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';
import { AuditService } from '@/infrastructure/audit/audit.service';

// const memberRepo = new DrizzleMemberRepository(); // Will be used in future for advanced member queries

// GET /api/admin/billing/subscriptions – Alle Abonnements (SuperAdmin only)
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
    const isSuperAdmin = roles.includes('superadmin');

    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all members with subscription info
    // Assuming members table has: subscription_tier, subscription_status, stripe_customer_id, stripe_subscription_id, current_period_end
    const { data: members, error: membersError } = await supabase
      .from('users')
      .select(
        `
        id,
        email,
        full_name,
        subscription_tier,
        subscription_status,
        stripe_customer_id,
        current_period_end
      `
      )
      .order('created_at', { ascending: false });

    if (membersError) {
      return NextResponse.json({ error: membersError.message }, { status: 500 });
    }

    const subscriptions = (members || []).map((m: any) => ({
      id: `sub-${m.id}`,
      memberId: m.id,
      memberName: m.full_name || 'N/A',
      memberEmail: m.email,
      plan: m.subscription_tier || 'free',
      status: m.subscription_status || 'active',
      currentPeriodEnd: m.current_period_end || new Date().toISOString(),
      stripeCustomerId: m.stripe_customer_id,
      stripeSubscriptionId: m.stripe_subscription_id,
    }));

    return NextResponse.json(subscriptions);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/admin/billing/subscriptions – Assign/update subscription
export async function POST(_req: NextRequest) {
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

    const body = await _req.json();
    const { memberId, plan } = body;

    if (!memberId || !plan) {
      return NextResponse.json({ error: 'memberId and plan are required' }, { status: 400 });
    }

    const validPlans = ['free', 'pro', 'enterprise'];
    if (!validPlans.includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Update member's subscription fields
    const updateData: Record<string, any> = {
      subscription_tier: plan,
      subscription_status: 'active',
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', memberId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Audit log
    await AuditService.logRoleChange(user.id, memberId, 'subscription', plan);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error assigning subscription:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

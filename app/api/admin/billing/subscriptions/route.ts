import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/external/supabase/server';
import { AuditService } from '@/infrastructure/audit/audit.service';
import { assignSubscriptionSchema } from '@/application/validation/schemas';
import { withValidation } from '@/application/validation/validator';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { rateLimit, rateLimitStrict, checkRateLimitOrFail } from '@/lib/rate-limit';

// const memberRepo = new DrizzleMemberRepository(); // Will be used in future for advanced member queries

// GET /api/admin/billing/subscriptions – Alle Abonnements (SuperAdmin only)
export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Rate limiting
    const rateLimitError = await checkRateLimitOrFail(_request, rateLimit);
    if (rateLimitError) return rateLimitError;

    // Permission check
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) return forbiddenResponse('Admin access required');

    try {
      const supabase = await createClient();

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
  });
}

// POST /api/admin/billing/subscriptions – Assign/update subscription
export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Rate limiting (strict for POST)
    const rateLimitError = await checkRateLimitOrFail(_request, rateLimitStrict);
    if (rateLimitError) return rateLimitError;

    // Permission check
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) return forbiddenResponse('Admin access required');

    try {
      return withValidation(assignSubscriptionSchema, async (input) => {
        const { memberId, plan } = input;
        const supabase = await createClient();

        // Update member's subscription fields
        const updateData: Record<string, string | boolean> = {
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
        await AuditService.logSubscriptionAssigned(auth.user.id, memberId, plan);

        return NextResponse.json({ success: true });
      })(_request);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      console.error('Error assigning subscription:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

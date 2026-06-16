import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';
import { AuditServiceImpl } from '@/infrastructure/audit/audit.service';
import { assignSubscriptionSchema } from '@/application/validation/schemas';
import { withValidation } from '@/application/validation/validator';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:admin:billing:subscriptions');

// const memberRepo = new DrizzleMemberRepository(); // Will be used in future for advanced member queries
const auditService = new AuditServiceImpl();

// GET /api/admin/billing/subscriptions – Alle Abonnements (SuperAdmin only)
export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Rate limiting
    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) return rateLimitError;

    // Permission check
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) return forbiddenResponse('Admin access required');

    try {
      const supabase = auth.supabase;
      const clubId = auth.clubId;
      if (!clubId) {
        return NextResponse.json({ error: 'No club selected' }, { status: 400 });
      }

      // Fetch members of the current club with subscription info
      const { data: memberships, error: membersError } = await supabase
        .from('user_club_memberships')
        .select(
          `
          users (
            id,
            email,
            full_name,
            subscription_tier,
            subscription_status,
            stripe_customer_id,
            current_period_end
          )
        `
        )
        .eq('club_id', clubId)
        .eq('is_active', true)
        .eq('role', 'member'); // only members have subscriptions

      if (membersError) {
        return NextResponse.json({ error: membersError.message }, { status: 500 });
      }

      const subscriptions = (memberships || [])
        .map((m: any) => {
          const user = m.users;
          if (!user) return null;
          return {
            id: `sub-${user.id}`,
            memberId: user.id,
            memberName: user.full_name || 'N/A',
            memberEmail: user.email,
            plan: user.subscription_tier || 'free',
            status: user.subscription_status || 'active',
            currentPeriodEnd: user.current_period_end || new Date().toISOString(),
            stripeCustomerId: user.stripe_customer_id,
            stripeSubscriptionId: user.stripe_subscription_id,
          };
        })
        .filter(Boolean);

      return NextResponse.json(subscriptions);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      log.error('Error fetching subscriptions:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

// POST /api/admin/billing/subscriptions – Assign/update subscription
export async function POST(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Rate limiting (strict for POST)
    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STRICT);
    if (rateLimitError) {
      return rateLimitError;
    }

    // Permission check
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) return forbiddenResponse('Admin access required');

    try {
      return withValidation(assignSubscriptionSchema, async (input) => {
        const { memberId, plan } = input;
        const supabase = auth.supabase;
        const clubId = auth.clubId;
        if (!clubId) {
          return NextResponse.json({ error: 'No club selected' }, { status: 400 });
        }

        // Verify that the member belongs to the admin's club
        const { data: membership, error: membershipError } = await supabase
          .from('user_club_memberships')
          .select('club_id')
          .eq('user_id', memberId)
          .eq('club_id', clubId)
          .eq('is_active', true)
          .single();

        if (membershipError || !membership) {
          return NextResponse.json(
            { error: 'Mitglied nicht im aktuellen Verein gefunden' },
            { status: 403 }
          );
        }

        // Update member's subscription fields
        const { error: updateError } = await supabase
          .from('users')
          .update({
            subscription_tier: plan,
            subscription_status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', memberId);

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        // Audit log
        await auditService.log({
          userId: auth.user.id,
          action: 'create',
          entityType: 'payment',
          entityId: memberId,
          details: { plan },
        });

        return NextResponse.json({ success: true });
      })(_request);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      log.error('Error assigning subscription:', error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

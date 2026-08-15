/**
 * POST /api/clubs/[id]/stripe-sync
 *
 * Sprint 3 / Ticket 3.6.1 — Pay-per-Active-Member-Pricing.
 * Manually triggers a Stripe subscription-quantity sync for the club-admin's
 * SaaS subscription. Idempotent — running it twice in a row makes only one
 * Stripe API call (cached quantity matches).
 *
 * Auth: owner / admin / superadmin only. Trainer/member → 403.
 *
 * Body: empty. Returns:
 *   200 { updated, newQuantity, reason, activeMemberCount, stripeSubscriptionId }
 *   400 { error } — invalid club id
 *   401 { error } — not authenticated
 *   403 { error } — role below admin
 *   404 { error } — user has no stripe_subscription_id
 *   429 { error } — rate-limited
 *
 * ──────────────────────────────────────────────────────────────────────
 * KNOWN LIMITATIONS (documented per code-reviewer PASS, accepted):
 * ──────────────────────────────────────────────────────────────────────
 * 1. RACE CONDITION on concurrent calls: two admins hitting the endpoint at
 *    the same time will both pass the threshold check and both call Stripe.
 *    The second `subscriptionItems.update` is idempotent at Stripe-side
 *    (last-write-wins), so monetary impact is zero. The `users.` cache
 *    writes also race — last commit wins, also fine.
 * 2. TARGET-QUANTITY=0 EDGE: a club with zero active members still triggers
 *    a `first-sync` push with quantity=0 (deliberate, per spec — prevents
 *    sticker-shock on first invoice after migration). Stripe accepts
 *    quantity=0 → billing line goes to $0 for that period.
 * 3. OWNER-RESOLUTION LIMITATION: the route picks the first admin user with
 *    `stripe_subscription_id IS NOT NULL`. If a club has multiple admins
 *    (one who paid, one who didn't), the payer is preferred via the
 *    IS NOT NULL filter. If multiple payers exist on the same club (e.g.
 *    after ownership transfer), the result is non-deterministic — manual
 *    migration to a single-payer model is the recommended fix.
 * 4. NO RETRY on Stripe-API transient errors: V1 returns `failed` immediately
 *    with the error message in the response body. Caller can re-attempt the
 *    endpoint manually. A retry-queue is out-of-scope for this ticket.
 * 5. PRODUCTION-ACTIVATION (manual, dev-machine-only): the migration
 *    `supabase/migrations/20260628_add_stripe_quantity_sync.sql` must be
 *    applied via `npx supabase db push` (or psql-direct equivalent). Without
 *    this, `stripe_subscription_quantity_synced` column is NULL and the
 *    `shouldSyncQuantity` path treats every call as `first-sync` → +1 Stripe
 *    API call per admin click. Functionally harmless but wasteful.
 * ──────────────────────────────────────────────────────────────────────
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { stripe } from '@/lib/stripe/stripe-client';
import { withApiAuth, forbiddenResponse } from '@/lib/api-auth';
import { checkRateLimitOrFail } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import {
  syncSubscriptionItemQuantity,
  type SyncQuantityResult,
} from '@/lib/services/stripe-subscription-quantity-sync.service';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:clubs:stripe-sync');

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  return withApiAuth(request, async (auth) => {
    // Gate to admin-or-above (owner/superadmin/admin permitted, trainer/member rejected).
    // Owner is implicit via withApiAuth → goes through verifyRole escalation.
    if (!['owner', 'superadmin', 'admin'].includes(auth.role)) {
      return forbiddenResponse('Nur Admins können die Stripe-Subscription synchronisieren.');
    }

    const rateLimitResponse = await checkRateLimitOrFail(request, 'strict');
    if (rateLimitResponse) return rateLimitResponse;

    const { id: clubId } = await context.params;
    if (!clubId) {
      return NextResponse.json({ error: 'Club-ID erforderlich' }, { status: 400 });
    }

    // Club-Access-Verification: superadmin always passes; admin must own this club.
    if (auth.role !== 'superadmin' && auth.role !== 'owner' && auth.clubId !== clubId) {
      return forbiddenResponse('Zugriff auf diesen Verein nicht erlaubt.');
    }

    const supabase = createServiceClient();

    // Two-step owner resolution (avoids PostgREST FK-name-syntax fragility):
    //   (1) collect admin user_ids for this club
    //   (2) fetch users with stripe_subscription_id IS NOT NULL
    //   (3) intersection — first match wins
    // The IS NOT NULL filter is the safety belt: prevents picking an admin who
    // never paid the SaaS subscription (their row has no stripe_subscription_id).
    // Cast through the explicit shape (no `unknown`) because we only use fields
    // we select ourselves.
    // No `.limit()` here — Supabase postgres-js default 1000-row cap is
    // generous for typical 1–5-admin clubs, and dropping the silent cap
    // avoids a hidden "admins #11+ ignored" surface. The `users.in(...)`
    // query below is the actual bottleneck (~10 admin_ids cap on IN-list
    // perf is fine, see limit-N-in() perf-cost analysis on supabase-js docs).
    const { data: adminMemberships, error: adminErr } = await supabase
      .from('user_club_memberships')
      .select('user_id')
      .eq('club_id', clubId)
      .eq('role', 'admin')
      .eq('is_active', true);

    if (adminErr) {
      log.error('Admin-resolution failed', adminErr);
      return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
    }
    if (!adminMemberships || adminMemberships.length === 0) {
      return NextResponse.json({ error: 'Kein Admin für diesen Verein gefunden' }, { status: 404 });
    }

    const adminUserIds = adminMemberships.map((m) => m.user_id as string);
    const { data: ownerCandidates, error: ownerErr } = await supabase
      .from('users')
      .select('id, stripe_subscription_id, stripe_subscription_quantity_synced')
      .in('id', adminUserIds)
      .not('stripe_subscription_id', 'is', null);

    if (ownerErr) {
      log.error('User-fetch for owner-resolution failed', ownerErr);
      return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
    }
    const ownerUser = ownerCandidates?.[0];
    if (!ownerUser?.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'Kein Stripe-Abo für diesen Verein hinterlegt' },
        { status: 404 }
      );
    }

    // Count active members — role='member' only; trainers/admins must not inflate the Stripe quantity.
    const { count: activeMemberCount, error: countErr } = await supabase
      .from('user_club_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('is_active', true)
      .eq('role', 'member');

    if (countErr) {
      log.error('Active member count failed', countErr);
      return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
    }

    const targetQuantity = activeMemberCount ?? 0;

    const syncResult: SyncQuantityResult = await syncSubscriptionItemQuantity({
      stripe: stripe(),
      subscriptionId: ownerUser.stripe_subscription_id,
      currentSyncedQuantity: ownerUser.stripe_subscription_quantity_synced ?? null,
      targetQuantity,
    });

    // Persist the cache only on successful sync — failed attempts must not poison
    // the idempotency check; otherwise retries would short-circuit the next manual call.
    if (syncResult.updated && syncResult.newQuantity != null) {
      await supabase
        .from('users')
        .update({
          stripe_subscription_quantity_synced: syncResult.newQuantity,
          stripe_subscription_quantity_synced_at: new Date().toISOString(),
        })
        .eq('id', ownerUser.id);
    }

    // Audit log row (best-effort; Stripe-sync failures are still auditable).
    await logAudit({
      actorId: auth.user.id,
      action: 'STRIPE_QUANTITY_SYNC',
      resourceType: 'club',
      resourceId: clubId,
      clubId,
      details: {
        targetQuantity,
        activeMemberCount,
        stripeSubscriptionId: ownerUser.stripe_subscription_id,
        syncResult,
      },
      request,
    });

    return NextResponse.json({
      updated: syncResult.updated,
      newQuantity: syncResult.newQuantity,
      reason: syncResult.reason,
      activeMemberCount,
      stripeSubscriptionId: ownerUser.stripe_subscription_id,
      ...(syncResult.error ? { error: syncResult.error } : {}),
    });
  }).catch((err) => {
    if (err instanceof NextResponse) return err;
    log.error('Unerwarteter Fehler in stripe-sync', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  });
}

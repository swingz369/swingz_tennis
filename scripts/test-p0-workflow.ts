/**
 * E2E API Test for P0 Blockers
 * Tests: Auto-Invoice on Approval → Billing → PDF Email
 * Usage: npx tsx scripts/test-p0-workflow.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  P0 BLOCKER E2E WORKFLOW TEST');
  console.log('═══════════════════════════════════════════\n');

  // ── Step 1: Login as admin ──────────────────────────────
  console.log('Step 1: Login as admin...');
  const loginRes = await fetch(`${BASE_URL}/auth/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    redirect: 'manual',
  });

  // Use Supabase signInWithPassword via the Supabase REST API
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const tokenRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({
      email: 'admin@swingz.com',
      password: 'AdminPass123!',
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error('❌ Login failed:', err);
    return;
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token;
  console.log('✅ Logged in (token:', accessToken.slice(0, 20) + '...)');

  // Build cookie string the way Supabase SSR expects it
  const authCookieValue = JSON.stringify({
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: tokenData.expires_at,
    expires_in: tokenData.expires_in,
    token_type: tokenData.token_type,
    user: tokenData.user,
  });
  const cookieStr = `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL!.split('//')[1].split('.')[0]}-auth-token=${encodeURIComponent(authCookieValue)}`;

  // ── Step 2: Get CSRF token ──────────────────────────────
  console.log('\nStep 2: Get CSRF token...');
  const csrfRes = await fetch(`${BASE_URL}/api/csrf-token`, {
    headers: { Cookie: cookieStr },
  });
  let csrfToken = '';
  if (csrfRes.ok) {
    const csrfData = await csrfRes.json();
    csrfToken = csrfData.token;
    console.log('✅ CSRF token:', csrfToken.slice(0, 20) + '...');
  } else {
    console.log('⚠️  CSRF endpoint returned:', csrfRes.status, '(may not be needed for approvals)');
  }

  // ── Step 3: Find pending registration ───────────────────
  console.log('\nStep 3: Find pending registration...');
  const approvalsRes = await fetch(`${BASE_URL}/api/admin/approvals`, {
    headers: {
      Cookie: cookieStr,
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    },
  });

  if (!approvalsRes.ok) {
    const errText = await approvalsRes.text();
    console.error(
      '❌ GET /api/admin/approvals failed:',
      approvalsRes.status,
      errText.slice(0, 200)
    );
    return;
  }

  const approvalsData = await approvalsRes.json();
  const pending = (approvalsData.requests || []).filter(
    (r: { status: string }) => r.status === 'pending'
  );

  if (pending.length === 0) {
    console.log('❌ No pending registrations found');
    return;
  }

  const reg = pending[0];
  console.log(`✅ Found pending: ${reg.first_name} ${reg.last_name} (${reg.email})`);
  console.log(`   ID: ${reg.id}`);

  // ── Step 4: Approve registration (P0-1: Auto-Invoice) ──
  console.log('\nStep 4: Approve registration...');
  const approveRes = await fetch(`${BASE_URL}/api/admin/approvals`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieStr,
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    },
    body: JSON.stringify({ id: reg.id, status: 'approved' }),
  });

  const approveData = await approveRes.json();
  console.log('Response status:', approveRes.status);

  if (approveRes.ok) {
    console.log('✅ Approval succeeded!');
    if (approveData.warning) console.log('⚠️  Warning:', approveData.warning);
  } else {
    console.log('❌ Approval failed:', JSON.stringify(approveData));
    return;
  }

  // ── Step 5: Check auto-created invoice ──────────────────
  console.log('\nStep 5: Check auto-created invoice...');

  // Wait a moment for async operations
  await new Promise((r) => setTimeout(r, 2000));

  // Use service client to check invoices directly
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: newUsers } = await sb.auth.admin.listUsers({ email: reg.email });
  if (newUsers && newUsers.length > 0) {
    const newUserId = newUsers[0].id;
    console.log('New user ID:', newUserId.slice(0, 8) + '...');

    const { data: invoices } = await sb
      .from('invoices')
      .select('id, invoice_number, amount, status, notes')
      .eq('member_id', newUserId);

    if (invoices && invoices.length > 0) {
      console.log('✅ Auto-invoice created!');
      for (const inv of invoices) {
        console.log(`  📄 ${inv.invoice_number} — €${inv.amount} — ${inv.status}`);
        console.log(`     ${inv.notes}`);
      }
    } else {
      console.log('❌ No auto-invoice created for new member');
    }
  } else {
    console.log('❌ Auth user not found for', reg.email);
  }

  // ── Step 6: Check billing overview ──────────────────────
  console.log('\nStep 6: Check billing overview...');
  // Get club_id from the pending registration
  const clubId = reg.club_id;
  console.log(`   Club ID: ${clubId}`);

  const billingRes = await fetch(`${BASE_URL}/api/billing/invoices/overview?clubId=${clubId}`, {
    headers: {
      Cookie: cookieStr,
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    },
  });

  if (billingRes.ok) {
    const billingData = await billingRes.json();
    console.log('✅ Billing overview loaded');
    if (billingData.invoices) {
      console.log(`   Total invoices: ${billingData.invoices.length}`);
    }
  } else {
    console.log('⚠️  Billing overview:', billingRes.status);
  }

  // ── Step 7: Check PDF email endpoint availability ───────
  console.log('\nStep 7: Check PDF email endpoint...');
  // Just verify the endpoint exists (won't actually send without a real invoice)
  const testEmailRes = await fetch(`${BASE_URL}/api/billing/invoices/nonexistent-id/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieStr,
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    },
  });
  console.log(
    'PDF email endpoint status:',
    testEmailRes.status,
    testEmailRes.status === 404 ? '(expected — no real invoice ID)' : ''
  );

  // ── Summary ─────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════');
  console.log('  TEST COMPLETE');
  console.log('═══════════════════════════════════════════');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

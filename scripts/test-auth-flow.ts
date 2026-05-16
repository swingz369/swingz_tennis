/**
 * Comprehensive Auth Flow Test
 * Tests the entire authentication flow from login to API access
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function testAuthFlow() {
  console.log('\n🔐 COMPREHENSIVE AUTH FLOW TEST\n');
  console.log('='.repeat(60));

  // Step 1: Test Supabase connection
  console.log('\n1️⃣  Testing Supabase Connection...');
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: _healthCheck, error: healthError } = await supabase
    .from('clubs')
    .select('id')
    .limit(1);

  if (healthError) {
    console.error('❌ Supabase connection failed:', healthError);
    return;
  }
  console.log('✅ Supabase connection OK');

  // Step 2: Test login
  console.log('\n2️⃣  Testing Login Flow...');
  const testEmail = 'admin@swingz.com';
  const testPassword = 'AdminPass123!';

  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (loginError) {
    console.error('❌ Login failed:', loginError.message);
    return;
  }

  if (!loginData.session) {
    console.error('❌ No session created after login');
    return;
  }

  console.log('✅ Login successful');
  console.log('   User ID:', loginData.user.id);
  console.log('   Email:', loginData.user.email);
  console.log('   Session expires:', new Date(loginData.session.expires_at! * 1000).toISOString());

  // Step 3: Test session persistence
  console.log('\n3️⃣  Testing Session Persistence...');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.error('❌ Session retrieval failed:', sessionError);
    return;
  }

  if (!sessionData.session) {
    console.error('❌ Session not persisted');
    return;
  }

  console.log('✅ Session persisted');
  console.log(
    '   Access Token (first 20 chars):',
    sessionData.session.access_token.substring(0, 20) + '...'
  );

  // Step 4: Test user data retrieval
  console.log('\n4️⃣  Testing User Data Retrieval...');
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('❌ User retrieval failed:', userError);
    return;
  }

  if (!userData.user) {
    console.error('❌ No user data returned');
    return;
  }

  console.log('✅ User data retrieved');
  console.log('   User ID:', userData.user.id);

  // Step 5: Test club memberships
  console.log('\n5️⃣  Testing Club Memberships...');
  const { data: memberships, error: membershipError } = await supabase
    .from('user_club_memberships')
    .select('role, club_id, is_active, clubs(id, name)')
    .eq('user_id', userData.user.id)
    .eq('is_active', true);

  if (membershipError) {
    console.error('❌ Membership retrieval failed:', membershipError);
    return;
  }

  if (!memberships || memberships.length === 0) {
    console.error('❌ No active memberships found');
    return;
  }

  console.log('✅ Memberships retrieved');
  console.log('   Active memberships:', memberships.length);
  memberships.forEach((m: any, i: number) => {
    console.log(`   ${i + 1}. Role: ${m.role}, Club: ${m.clubs?.name || 'Unknown'}`);
  });

  // Step 6: Test API-like database access with RLS
  console.log('\n6️⃣  Testing Database Access (RLS)...');
  const { data: courtsData, error: courtsError } = await supabase
    .from('courts')
    .select('id, name, club_id')
    .limit(5);

  if (courtsError) {
    console.error('❌ Courts retrieval failed:', courtsError);
    console.error('   This might indicate RLS policies blocking access');
  } else {
    console.log('✅ Courts data retrieved');
    console.log('   Courts found:', courtsData?.length || 0);
  }

  // Step 7: Test auth state
  console.log('\n7️⃣  Testing Auth State...');
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    console.error('❌ Auth state lost');
    return;
  }

  console.log('✅ Auth state maintained');

  // Step 8: Summary
  console.log('\n📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log('✅ All basic auth flows working');
  console.log('✅ Session: VALID');
  console.log('✅ User: AUTHENTICATED');
  console.log('✅ Memberships: FOUND');
  console.log('\n🎯 Next: Test this flow on Vercel Production');
  console.log('   If this passes locally but fails on Vercel:');
  console.log('   → Check Vercel environment variables');
  console.log('   → Check Supabase Site URL configuration');
  console.log('   → Check cookie settings in middleware');
  console.log('   → Check if cookies are being sent in requests');

  // Cleanup: sign out
  await supabase.auth.signOut();
  console.log('\n🧹 Signed out\n');
}

testAuthFlow().catch(console.error);

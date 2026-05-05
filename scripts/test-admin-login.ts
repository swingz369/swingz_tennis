import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function testAdminLogin() {
  console.log('🔐 Testing Admin Login\n');
  console.log('='.repeat(80));

  const testEmail = 'admin-badminton-club-hamburg@swingz.com';
  const testPassword = 'AdminPass123!';

  console.log(`\n📧 Testing login for: ${testEmail}`);

  // Check if user exists
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users?.users.find((u) => u.email === testEmail);

  if (!user) {
    console.log('❌ User not found!');
    return;
  }

  console.log(`✅ User exists: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Created: ${user.created_at}`);

  // Check memberships
  const { data: memberships, error: membershipError } = await supabase
    .from('user_club_memberships')
    .select('*, clubs(name)')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (membershipError) {
    console.log('❌ Error fetching memberships:', membershipError);
    return;
  }

  console.log(`\n👥 Memberships: ${memberships?.length || 0}`);
  for (const membership of memberships || []) {
    console.log(`   - ${(membership as any).clubs?.name || 'Unknown'}: ${membership.role}`);
  }

  // Try to sign in
  console.log(`\n🔑 Attempting sign in...`);

  const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (signInError) {
    console.log('❌ Sign in failed:', signInError.message);
    return;
  }

  console.log('✅ Sign in successful!');
  console.log(`   User ID: ${signInData.user?.id}`);
  console.log(`   Session: ${signInData.session ? 'Present' : 'Missing'}`);
  console.log(`   Access Token: ${signInData.session?.access_token ? 'Present' : 'Missing'}`);

  if (signInData.session) {
    console.log(`\n🍪 Session Details:`);
    console.log(`   Expires: ${new Date(signInData.session.expires_at! * 1000).toISOString()}`);
    console.log(`   Token Type: ${signInData.session.token_type}`);
  }

  // Test API call with token
  console.log(`\n📡 Testing API call with session...`);

  // We can't easily test cookies here, but we can verify the token works
  const { data: testUser, error: testError } = await anonClient.auth.getUser(
    signInData.session?.access_token
  );

  if (testError) {
    console.log('❌ Token validation failed:', testError.message);
  } else {
    console.log('✅ Token is valid');
    console.log(`   User: ${testUser.user?.email}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Test complete!');
  console.log(
    '\nNext step: Test actual login on https://swingz.vercel.app/login with these credentials'
  );
}

testAdminLogin()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });

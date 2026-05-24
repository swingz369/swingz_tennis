// scripts/seed-test-billing-user.ts
// Creates a test user in auth.users for billing integration tests.
// Usage: npx tsx scripts/seed-test-billing-user.ts
// Output:  TEST_MEMBER_UUID=<uuid>  (use this in billing tests)

import { createServiceClient } from '@/lib/supabase/service';
import crypto from 'crypto';

const supabase = createServiceClient();

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
    process.exit(1);
  }

  const email = `billing-test-${Date.now()}@swingz.local`;
  const password = crypto.randomBytes(12).toString('base64url') + '!A1';

  // 1. Create user in auth.users
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'member' },
  });

  if (error) {
    console.error('❌ Failed to create auth user:', error.message);
    process.exit(1);
  }

  const userId = data.user.id;
  console.log(`✅ Created auth user: ${email} (id=${userId})`);

  // 2. Insert into users/profile table
  const { error: profileError } = await supabase.from('users').upsert({
    id: userId,
    email,
    full_name: 'Billing Test User',
    role: 'member',
    created_at: new Date().toISOString(),
  });

  if (profileError) {
    console.warn(`⚠️  Profile insert warning (may be OK): ${profileError.message}`);
  } else {
    console.log('✅ Created user profile');
  }

  // 3. Output credentials for test config
  console.log('\n--- Copy into .env.local or test config ---');
  console.log(`TEST_MEMBER_UUID=${userId}`);
  console.log(`TEST_MEMBER_EMAIL=${email}`);
  console.log(`TEST_MEMBER_PASSWORD=${password}`);
  console.log('--------------------------------------------\n');
  console.log('⚠️  Store these credentials securely. They are NOT saved to disk.');
}

main().catch(console.error);

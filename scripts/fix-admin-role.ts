/**
 * Fix Admin Role in Production
 * Changes admin@swingz.com from superadmin to admin role
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function fixAdminRole() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials in .env.local');
  }

  console.log('🔧 Fixing admin@swingz.com role in production...\n');

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Find the user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', 'admin@swingz.com')
    .single();

  if (userError || !user) {
    console.error('❌ User not found:', userError);
    return;
  }

  console.log('✅ Found user:', user.email);

  // 2. Get current membership
  const { data: memberships, error: membershipError } = await supabase
    .from('user_club_memberships')
    .select('id, role, club_id, clubs(name)')
    .eq('user_id', user.id);

  if (membershipError || !memberships || memberships.length === 0) {
    console.error('❌ No memberships found:', membershipError);
    return;
  }

  console.log('\n📋 Current memberships:');
  memberships.forEach((m: any) => {
    const clubName = Array.isArray(m.clubs) ? m.clubs[0]?.name : m.clubs?.name;
    console.log(`  - ${clubName}: ${m.role}`);
  });

  // 3. Update role from superadmin to admin
  const superadminMembership = memberships.find((m: any) => m.role === 'superadmin');

  if (!superadminMembership) {
    console.log('\n✅ User already has correct role (not superadmin)');
    return;
  }

  console.log('\n🔄 Updating role from superadmin to admin...');

  const { error: updateError } = await supabase
    .from('user_club_memberships')
    .update({ role: 'admin', updated_at: new Date().toISOString() })
    .eq('id', superadminMembership.id);

  if (updateError) {
    console.error('❌ Failed to update role:', updateError);
    return;
  }

  console.log('✅ Role updated successfully!\n');

  // 4. Verify update
  const { data: updatedMemberships } = await supabase
    .from('user_club_memberships')
    .select('role, clubs(name)')
    .eq('user_id', user.id);

  console.log('📋 Updated memberships:');
  updatedMemberships?.forEach((m: any) => {
    const clubName = Array.isArray(m.clubs) ? m.clubs[0]?.name : m.clubs?.name;
    console.log(`  - ${clubName}: ${m.role}`);
  });

  console.log('\n✅ Admin role fix completed!');
  console.log('ℹ️  User can now access:');
  console.log('  - /dashboard (AdminDashboard)');
  console.log('  - /admin/panel-v2 (Admin Panel)');
  console.log('  - /admin/members, /admin/courts, etc.');
  console.log(
    '  ❌ Cannot access: /admin/dashboard, /admin/tenants, /admin/clubs (superadmin-only)'
  );
}

fixAdminRole().catch(console.error);

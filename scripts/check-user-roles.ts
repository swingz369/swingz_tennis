import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUserRoles() {
  console.log('\n🔍 Checking roles for admin@swingz.com...\n');

  // 1. Get user
  const { data: users, error: userError } = await supabase.auth.admin.listUsers();

  if (userError) {
    console.error('❌ Error fetching users:', userError);
    return;
  }

  const adminUser = users.users.find((u) => u.email === 'admin@swingz.com');

  if (!adminUser) {
    console.error('❌ User admin@swingz.com not found!');
    return;
  }

  console.log('✅ User found:', adminUser.id);

  // 2. Get ALL memberships (including inactive)
  const { data: allMemberships, error: allError } = await supabase
    .from('user_club_memberships')
    .select('role, club_id, is_active, clubs(name)')
    .eq('user_id', adminUser.id);

  console.log('\n📊 ALL memberships (including inactive):');
  console.log(allMemberships);

  // 3. Get ACTIVE memberships only
  const { data: activeMemberships, error: activeError } = await supabase
    .from('user_club_memberships')
    .select('role, club_id, is_active, clubs(name)')
    .eq('user_id', adminUser.id)
    .eq('is_active', true);

  console.log('\n✅ ACTIVE memberships only:');
  console.log(activeMemberships);

  // 4. Check specific club
  const targetClubId = '30b0d39d-a152-4d2d-bd57-d23220794d41';
  const { data: targetMembership, error: targetError } = await supabase
    .from('user_club_memberships')
    .select('role, club_id, is_active, clubs(name)')
    .eq('user_id', adminUser.id)
    .eq('club_id', targetClubId)
    .single();

  console.log(`\n🎯 Membership for club ${targetClubId}:`);
  console.log(targetMembership);

  // Summary
  console.log('\n📝 Summary:');
  console.log(`- Total memberships: ${allMemberships?.length || 0}`);
  console.log(`- Active memberships: ${activeMemberships?.length || 0}`);
  console.log(
    `- Has admin role for target club: ${targetMembership?.role === 'admin' && targetMembership?.is_active ? '✅ YES' : '❌ NO'}`
  );
}

checkUserRoles();

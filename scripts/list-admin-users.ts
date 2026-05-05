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

async function listAdminUsers() {
  console.log('👥 Admin Users per Club\n');
  console.log('='.repeat(80));

  // Get all clubs
  const { data: clubs } = await supabase.from('clubs').select('id, name').order('name');

  if (!clubs || clubs.length === 0) {
    console.log('❌ No clubs found');
    return;
  }

  for (const club of clubs) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`\n🏢 ${club.name} (${club.id})\n`);

    // Get admin memberships
    const { data: memberships } = await supabase
      .from('user_club_memberships')
      .select('user_id, role, is_active')
      .eq('club_id', club.id)
      .eq('is_active', true)
      .in('role', ['admin', 'superadmin']);

    if (!memberships || memberships.length === 0) {
      console.log('⚠️  No admins found');
      continue;
    }

    // Get user details
    const { data: authUsers } = await supabase.auth.admin.listUsers();

    for (const membership of memberships) {
      const user = authUsers?.users.find((u) => u.id === membership.user_id);
      if (user) {
        console.log(`   👤 ${membership.role.toUpperCase()}`);
        console.log(`      Email: ${user.email}`);
        console.log(`      Name: ${user.user_metadata?.full_name || 'N/A'}`);
        console.log(`      User ID: ${user.id}`);
      } else {
        console.log(
          `   ⚠️  ${membership.role.toUpperCase()} - User not found: ${membership.user_id}`
        );
      }
    }
  }

  console.log(`\n${'='.repeat(80)}\n`);
  console.log('✅ Complete!');
  console.log('\n📝 Test Login Credentials:');
  console.log('   Use any of the emails above');
  console.log('   Default password format: AdminPass123! or TrainerPass123!');
}

listAdminUsers()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });

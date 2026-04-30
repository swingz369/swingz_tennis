import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qeckztuzeymuwwtyoryi.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlY2t6dHV6ZXltdXd3dHlvcnlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM0NzY0MiwiZXhwIjoyMDkyOTIzNjQyfQ.SCZbiLKSio02oC4rlQ8fpuLL_9MTnXEAVl86Ra1fzDA';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const TEST_USERS = [
  { email: 'admin@swingz.com',     password: 'AdminPass123!',   full_name: 'Admin User',     role: 'admin' },
  { email: 'trainer@swingz.com',   password: 'TrainerPass123!',  full_name: 'Max Trainer',    role: 'trainer' },
  { email: 'member@swingz.com',    password: 'MemberPass123!',   full_name: 'Anna Member',    role: 'member' },
  { email: 'superadmin@swingz.com',password: 'SuperPass123!',    full_name: 'Super Admin',    role: 'superadmin' },
];

async function main() {
  console.log('🌱 SwingZ User Seeder\n');
  console.log('═'.repeat(50));

  // Get/create club
  let { data: club } = await supabase.from('clubs').select('id').eq('name', 'Demo Tennis Club').single();
  let clubId: string;
  
  if (!club) {
    console.log('\n📝 Creating Demo Tennis Club...');
    const { data: c, error } = await supabase.from('clubs').insert({
      name: 'Demo Tennis Club',
      max_members: 500,
      opening_hours: {
        monday:    { open: '09:00', close: '22:00' },
        tuesday:   { open: '09:00', close: '22:00' },
        wednesday: { open: '09:00', close: '22:00' },
        thursday:  { open: '09:00', close: '22:00' },
        friday:    { open: '09:00', close: '22:00' },
        saturday:  { open: '09:00', close: '22:00' },
        sunday:    { open: '09:00', close: '22:00' },
      },
    }).select('id').single();

    if (error) throw error;
    clubId = c.id;
    console.log(`✅ Club created: ${c.id}`);
  } else {
    clubId = club.id;
    console.log(`✅ Using club: ${clubId}`);
  }

  console.log('\n👥 Processing users...\n');

  for (const user of TEST_USERS) {
    console.log(`🔸 ${user.email}`);

    // 1) Find or create Auth user
    let userId: string | undefined;
    
    // Try to find in Auth
    try {
      const { data: list } = await supabase.auth.admin.listUsers();
      const found = list?.users?.find((u: any) => u.email === user.email);
      if (found) {
        userId = found.id;
        console.log(`   └─ Auth user exists: ${userId}`);
      }
    } catch (e) {
      console.log(`   ⚠️ listUsers failed: ${e}`);
    }

    if (!userId) {
      console.log(`   └─ Creating Auth user...`);
      const { data: auth, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { full_name: user.full_name },
      });
      if (error) {
        console.error(`   ❌ Auth error: ${error.message}`);
        continue;
      }
      const a = auth as any;
      userId = a?.id || a?.user?.id;
      console.log(`   ✅ Created: ${userId}`);
    }

    // 2) Ensure profile in public.users
    // Check exists
    const { data: existing } = await supabase.from('users').select('id').eq('id', userId).single();
    
    if (existing) {
      console.log(`   └─ Profile exists, updating...`);
      const { error: upd } = await supabase.from('users').update({ full_name: user.full_name }).eq('id', userId);
      if (upd) console.error(`   ❌ Update error: ${upd.message}`);
      else console.log(`   ✅ Profile updated`);
    } else {
      console.log(`   └─ Profile missing, inserting...`);
      const { error: ins } = await supabase.from('users').insert({
        id: userId,
        email: user.email,
        full_name: user.full_name,
        created_at: new Date().toISOString(),
      });
      if (ins) {
        console.error(`   ❌ Insert error: ${ins.message}`);
        // Try delete duplicate emails first
        console.log(`   └─ Cleaning up duplicate emails...`);
        await supabase.from('users').delete().eq('email', user.email);
        console.log(`   └─ Retrying insert...`);
        const { error: ins2 } = await supabase.from('users').insert({
          id: userId,
          email: user.email,
          full_name: user.full_name,
          created_at: new Date().toISOString(),
        });
        if (ins2) console.error(`   ❌ Still failing: ${ins2.message}`);
        else console.log(`   ✅ Profile inserted after cleanup`);
      } else {
        console.log(`   ✅ Profile inserted`);
      }
    }

    // 3) Set club membership (delete old, insert new)
    await supabase.from('user_club_memberships').delete().eq('user_id', userId);
    
    const { error: memErr } = await supabase.from('user_club_memberships').insert({
      user_id: userId,
      club_id: clubId,
      role: user.role,
      is_active: true,
    });

    if (memErr) {
      console.error(`   ❌ Membership error: ${memErr.message}`);
    } else {
      console.log(`   ✅ Membership: ${user.role}\n`);
    }
  }

  console.log('═'.repeat(50));
  console.log('\n✨ Done!\n');
  console.log('📋 Login:');
  console.log('─'.repeat(50));
  TEST_USERS.forEach(u => {
    const roleLabel = { admin: '🔧 Admin', trainer: '🏋️ Trainer', member: '👤 Member', superadmin: '👑 Superadmin' };
    console.log(`${roleLabel[u.role as keyof typeof roleLabel]}  ${u.email}  |  ${u.password}`);
  });
  console.log('─'.repeat(50));
  console.log('\n🌐 https://swingz.vercel.app');
  console.log('💡 Delete "demo-mode" cookie after login\n');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

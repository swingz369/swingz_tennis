import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qeckztuzeymuwwtyoryi.supabase.co';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlY2t6dHV6ZXltdXd3dHlvcnlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM0NzY0MiwiZXhwIjoyMDkyOTIzNjQyfQ.SCZbiLKSio02oC4rlQ8fpuLL_9MTnXEAVl86Ra1fzDA';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const TEST_USERS = [
  { email: 'admin@swingz.com', password: 'AdminPass123!', full_name: 'Admin User', role: 'admin' },
  {
    email: 'trainer@swingz.com',
    password: 'TrainerPass123!',
    full_name: 'Max Trainer',
    role: 'trainer',
  },
  {
    email: 'member@swingz.com',
    password: 'MemberPass123!',
    full_name: 'Anna Member',
    role: 'member',
  },
  {
    email: 'superadmin@swingz.com',
    password: 'SuperPass123!',
    full_name: 'Super Admin',
    role: 'superadmin',
  },
];

async function main() {
  console.log('🌱 SwingZ User & Demo Data Seeder\n');
  console.log('═'.repeat(50));

  // Get/create club
  const { data: club } = await supabase
    .from('clubs')
    .select('id')
    .eq('name', 'Demo Tennis Club')
    .single();
  let clubId: string;

  if (!club) {
    console.log('\n📝 Creating Demo Tennis Club...');
    const { data: c, error } = await supabase
      .from('clubs')
      .insert({
        name: 'Demo Tennis Club',
        max_members: 500,
        opening_hours: {
          monday: { open: '09:00', close: '22:00' },
          tuesday: { open: '09:00', close: '22:00' },
          wednesday: { open: '09:00', close: '22:00' },
          thursday: { open: '09:00', close: '22:00' },
          friday: { open: '09:00', close: '22:00' },
          saturday: { open: '09:00', close: '22:00' },
          sunday: { open: '09:00', close: '22:00' },
        },
      })
      .select('id')
      .single();

    if (error) throw error;
    clubId = c.id;
    console.log(`✅ Club created: ${c.id}`);
  } else {
    clubId = club.id;
    console.log(`✅ Using club: ${clubId}`);
  }

  console.log('\n👥 Processing users...\n');

  // Keep track of created user IDs for later use
  const userIds: Record<string, string> = {};

  for (const user of TEST_USERS) {
    console.log(`🔸 ${user.email}`);

    // 1) Find or create Auth user
    let userId: string | undefined;

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

    if (!userId) {
      console.error(`   ❌ Could not get user ID for ${user.email}, skipping`);
      continue;
    }

    userIds[user.role] = userId;

    // 2) Ensure profile in public.users
    const { data: existing } = await supabase.from('users').select('id').eq('id', userId).single();

    if (existing) {
      console.log(`   └─ Profile exists, updating...`);
      const { error: upd } = await supabase
        .from('users')
        .update({ full_name: user.full_name })
        .eq('id', userId);
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

  console.log('🏟️  Seeding additional demo data...\n');

  // 4) Create courts for demo club
  console.log('   └─ Creating courts...');
  const { error: courtsErr } = await supabase
    .from('courts')
    .insert([
      {
        club_id: clubId,
        name: 'Court 1',
        surface: 'clay' as const,
        has_indoor: false,
        is_active: true,
      },
      {
        club_id: clubId,
        name: 'Court 2',
        surface: 'clay' as const,
        has_indoor: false,
        is_active: true,
      },
      {
        club_id: clubId,
        name: 'Court 3 (Indoor)',
        surface: 'hard' as const,
        has_indoor: true,
        is_active: true,
      },
    ])
    .select();
  if (courtsErr) console.log(`   ⚠️ Courts may already exist: ${courtsErr.message}`);
  else console.log(`   ✅ Courts created`);

  // 5) Create schedule for demo club
  console.log('   └─ Creating schedule...');
  const currentYear = new Date().getFullYear();
  const seasonStart = new Date(currentYear, 0, 1); // Jan 1
  const seasonEnd = new Date(currentYear, 11, 31); // Dec 31

  const currentYear = new Date().getFullYear();
  const seasonStart = new Date(currentYear, 0, 1); // Jan 1
  const seasonEnd = new Date(currentYear, 11, 31); // Dec 31

  const { data: schedule, error: scheduleErr } = await supabase
    .from('schedules')
    .insert({
      club_id: clubId,
      season_type: 'summer',
      season_year: currentYear,
      season_start_date: seasonStart.toISOString(),
      season_end_date: seasonEnd.toISOString(),
      is_active: true,
    })
    .select('id')
    .single();
  if (scheduleErr) {
    console.log(`   ⚠️ Schedule may exist: ${scheduleErr.message}`);
  } else {
    console.log(`   ✅ Schedule created: ${schedule.id}`);
  }
  const scheduleId =
    schedule?.id ||
    (await supabase.from('schedules').select('id').eq('club_id', clubId).single()).data?.id;
  if (!scheduleId) {
    console.error('   ❌ Could not get schedule ID');
    process.exit(1);
  }

  // 6) Create sessions for the next 2 weeks
  console.log('   └─ Creating sessions...');
  const trainerId = userIds['trainer'] || 'unknown';
  const now = new Date();

  const sessionsToInsert = [
    // Week 1: Today at 10:00-11:00
    {
      schedule_id: scheduleId,
      timeslot_start: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        10,
        0,
        0
      ).toISOString(),
      timeslot_end: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        11,
        0,
        0
      ).toISOString(),
      trainer_id: trainerId,
      max_participants: 4,
      notes: 'Anfänger',
      is_active: true,
    },
    // Week 3: +2 days at 14:00-15:30
    {
      schedule_id: scheduleId,
      timeslot_start: new Date(now.getTime() + 2 * 86400000, 14, 0, 0).toISOString(),
      timeslot_end: new Date(now.getTime() + 2 * 86400000, 15, 30, 0).toISOString(),
      trainer_id: trainerId,
      max_participants: 6,
      notes: 'Fortgeschrittene',
      is_active: true,
    },
    // Week 5: +4 days at 16:00-17:00
    {
      schedule_id: scheduleId,
      timeslot_start: new Date(now.getTime() + 4 * 86400000, 16, 0, 0).toISOString(),
      timeslot_end: new Date(now.getTime() + 4 * 86400000, 17, 0, 0).toISOString(),
      trainer_id: trainerId,
      max_participants: 8,
      notes: 'Mixed',
      is_active: true,
    },
  ];

  const { data: sessions, error: sessionsErr } = await supabase
    .from('sessions')
    .insert(sessionsToInsert)
    .select('id');
  if (sessionsErr) {
    console.log(`   ⚠️ Sessions may exist: ${sessionsErr.message}`);
  } else {
    console.log(`   ✅ ${sessions?.length || 0} sessions created`);
  }

  // 7) Create some demo bookings
  console.log('   └─ Creating demo bookings...');
  const sessionIds = sessions?.map((s: any) => s.id) || [];
  if (sessionIds.length > 0) {
    const memberId = userIds['member'] || 'unknown';
    const booking = {
      session_id: sessionIds[0],
      member_id: memberId,
      status: 'confirmed' as const,
      booked_at: new Date().toISOString(),
    };
    const { error: bookErr } = await supabase.from('bookings').insert(booking);
    if (bookErr) {
      console.log(`   ⚠️ Booking may exist: ${bookErr.message}`);
    } else {
      console.log(`   ✅ Demo booking created`);
    }
  }

  // 8) Create clubs analytics sample (if analytics table exists)
  console.log('   └─ Creating analytics sample...');
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  try {
    await supabase.from('club_analytics').insert({
      club_id: clubId,
      date: thirtyDaysAgo.toISOString().split('T')[0],
      total_members: 42,
      new_members: 5,
      active_members: 38,
      sessions_count: 12,
      attendance_rate: 0.85,
    });
    console.log(`   ✅ Analytics sample created`);
  } catch (e: any) {
    console.log(`   ⚠️ Analytics table may not exist yet: ${e.message}`);
  }

  console.log('\n' + '═'.repeat(50));
  console.log('\n✨ Demo data seeding complete!\n');
  console.log('📋 Login credentials:');
  console.log('─'.repeat(50));
  TEST_USERS.forEach((u) => {
    const roleLabel = {
      admin: '🔧 Admin',
      trainer: '🏋️ Trainer',
      member: '👤 Member',
      superadmin: '👑 Superadmin',
    };
    console.log(`${roleLabel[u.role as keyof typeof roleLabel]}  ${u.email}  |  ${u.password}`);
  });
  console.log('─'.repeat(50));
  console.log('\n🌐 https://swingz.vercel.app');
  console.log('💡 Delete "demo-mode" cookie after login\n');
  console.log('📊 Demo data includes:');
  console.log('   • 3 Courts (2 clay, 1 indoor hard)');
  console.log('   • Weekly schedule with 3 sessions');
  console.log('   • Sample bookings');
  console.log('   • Analytics metrics\n');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

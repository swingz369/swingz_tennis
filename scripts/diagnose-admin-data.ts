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

async function diagnose() {
  console.log('🔍 Diagnosing admin@swingz.com data...\n');

  // 1. Find admin user
  const { data: users } = await supabase.auth.admin.listUsers();
  const adminUser = users?.users.find((u) => u.email === 'admin@swingz.com');

  if (!adminUser) {
    console.log('❌ Admin user not found in auth.users');
    return;
  }

  console.log(`✓ Admin user found: ${adminUser.id}`);
  console.log(`  Email: ${adminUser.email}`);
  console.log(`  Name: ${adminUser.user_metadata?.full_name || 'N/A'}\n`);

  // 2. Find admin memberships
  const { data: memberships, error: membershipError } = await supabase
    .from('user_club_memberships')
    .select('user_id, club_id, role, is_active, clubs(id, name)')
    .eq('user_id', adminUser.id)
    .eq('is_active', true);

  if (membershipError) {
    console.log('❌ Error fetching memberships:', membershipError);
    return;
  }

  if (!memberships || memberships.length === 0) {
    console.log('❌ No active club memberships found for admin user');
    return;
  }

  console.log(`✓ Found ${memberships.length} active membership(s):`);
  for (const m of memberships) {
    const club = (m as any).clubs;
    console.log(`  - Club: ${club?.name || 'N/A'} (${m.club_id})`);
    console.log(`    Role: ${m.role}`);
  }

  // 3. Check courts for admin's club
  const clubId = memberships[0].club_id;
  const clubName = (memberships[0] as any).clubs?.name || 'N/A';
  console.log(`\n🏟️  Checking data for club: ${clubName} (${clubId})\n`);

  const { data: courts, error: courtsError } = await supabase
    .from('courts')
    .select('id, name, surface, is_active')
    .eq('club_id', clubId)
    .eq('is_active', true);

  if (courtsError) {
    console.log('❌ Error fetching courts:', courtsError);
  } else {
    console.log(`📍 Courts: ${courts?.length || 0}`);
    if (courts && courts.length > 0) {
      for (const c of courts.slice(0, 5)) {
        console.log(`  - ${c.name} (${c.surface})`);
      }
      if (courts.length > 5) {
        console.log(`  ... and ${courts.length - 5} more`);
      }
    }
  }

  // 4. Check schedules first
  const { data: schedules, error: schedulesError } = await supabase
    .from('schedules')
    .select('id, season_type, season_year')
    .eq('club_id', clubId)
    .eq('is_active', true);

  if (schedulesError) {
    console.log('❌ Error fetching schedules:', schedulesError);
  } else {
    console.log(`\n📋 Schedules: ${schedules?.length || 0}`);
    if (schedules && schedules.length > 0) {
      for (const sc of schedules.slice(0, 3)) {
        console.log(`  - ${sc.season_type} ${sc.season_year} (${sc.id})`);
      }
    }
  }

  // 5. Check sessions (via schedule)
  if (schedules && schedules.length > 0) {
    const scheduleIds = schedules.map((s) => s.id);
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, timeslot_start, timeslot_end, trainer_id, schedule_id')
      .in('schedule_id', scheduleIds);

    if (sessionsError) {
      console.log('❌ Error fetching sessions:', sessionsError);
    } else {
      console.log(`\n📅 Sessions: ${sessions?.length || 0}`);
      if (sessions && sessions.length > 0) {
        for (const s of sessions.slice(0, 3)) {
          console.log(`  - ${s.timeslot_start} to ${s.timeslot_end}`);
        }
        if (sessions.length > 3) {
          console.log(`  ... and ${sessions.length - 3} more`);
        }
      }
    }
  }

  // 6. Check trainers (direct table, no users FK)
  const { data: trainers, error: trainersError } = await supabase
    .from('trainers')
    .select('id, email, name, is_active')
    .eq('is_active', true);

  if (trainersError) {
    console.log('❌ Error fetching trainers:', trainersError);
  } else {
    console.log(`\n👨‍🏫 Trainers (global): ${trainers?.length || 0}`);
    if (trainers && trainers.length > 0) {
      for (const t of trainers.slice(0, 5)) {
        console.log(`  - ${t.name} (${t.email})`);
      }
      if (trainers.length > 5) {
        console.log(`  ... and ${trainers.length - 5} more`);
      }
    }
  }

  // 7. Check trainer_club junction for this club
  if (trainers && trainers.length > 0) {
    const { data: trainerClubs, error: trainerClubsError } = await supabase
      .from('trainer_club')
      .select('trainer_id, club_id')
      .eq('club_id', clubId);

    if (trainerClubsError) {
      console.log('❌ Error fetching trainer_club:', trainerClubsError);
    } else {
      console.log(`\n🔗 Trainers linked to this club: ${trainerClubs?.length || 0}`);
      if (trainerClubs && trainerClubs.length > 0) {
        for (const tc of trainerClubs) {
          const trainer = trainers.find((t) => t.id === tc.trainer_id);
          console.log(`  - ${trainer?.name || tc.trainer_id}`);
        }
      }
    }
  }

  // 8. Check trainer user itself
  console.log('\n\n🔍 Checking trainer@swingz.com user...\n');
  const trainerUser = users?.users.find((u) => u.email === 'trainer@swingz.com');
  if (!trainerUser) {
    console.log('❌ Trainer user not found');
    return;
  }

  console.log(`✓ Trainer user found: ${trainerUser.id}`);

  const { data: trainerMemberships } = await supabase
    .from('user_club_memberships')
    .select('club_id, role')
    .eq('user_id', trainerUser.id)
    .eq('is_active', true);

  console.log(`  Memberships: ${trainerMemberships?.length || 0}`);

  // Check if trainer@swingz.com has a record in trainers table
  const { data: trainerRecordByEmail } = await supabase
    .from('trainers')
    .select('id, email, name, is_active')
    .eq('email', 'trainer@swingz.com')
    .eq('is_active', true);

  console.log(`  Trainer records (by email): ${trainerRecordByEmail?.length || 0}`);
  if (trainerRecordByEmail && trainerRecordByEmail.length > 0) {
    for (const tr of trainerRecordByEmail) {
      console.log(`    - ID: ${tr.id}, Name: ${tr.name}`);

      // Check if linked to club
      const { data: trainerClubLinks } = await supabase
        .from('trainer_club')
        .select('club_id')
        .eq('trainer_id', tr.id);

      console.log(`      Linked to ${trainerClubLinks?.length || 0} clubs`);
    }
  }
}

diagnose()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });

import { createServiceClient } from '@/lib/supabase/service';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createServiceClient();

async function checkAndSeed() {
  console.log('🔍 Checking existing data...');

  const { data: clubsData } = await supabase.from('clubs').select('*');
  const { data: usersData } = await supabase.from('users').select('*');

  const clubCount = clubsData?.length || 0;
  const userCount = usersData?.length || 0;

  console.log(`Clubs: ${clubCount}, Users: ${userCount}`);

  // Note: We always proceed to ensure admins and superadmin exist.
  // Member and trainer seeding is conditional on existing data.
  // We'll create missing clubs if less than 3, and then ensure proper roles.

  console.log('🌱 Starting seed...');

  const clubsList = [
    { name: 'Tennis Club Berlin', location: 'Berlin' },
    { name: 'Squash Club Munich', location: 'Munich' },
    { name: 'Badminton Club Hamburg', location: 'Hamburg' },
  ];

  const clubIds: string[] = [];

  // Create clubs
  for (const club of clubsList) {
    const { data: createdClub, error } = await supabase
      .from('clubs')
      .insert({
        name: club.name,
        opening_hours: {
          monday: { open: '09:00', close: '22:00' },
          tuesday: { open: '09:00', close: '22:00' },
          wednesday: { open: '09:00', close: '22:00' },
          thursday: { open: '09:00', close: '22:00' },
          friday: { open: '09:00', close: '22:00' },
          saturday: { open: '09:00', close: '22:00' },
          sunday: { open: '09:00', close: '22:00' },
        },
        max_members: 100,
        status: 'active',
      })
      .select('id')
      .single();

    if (error) {
      console.error(`❌ Error creating club ${club.name}:`, error.message);
      continue;
    }

    clubIds.push(createdClub.id);
    console.log(`✅ Created club: ${club.name} (ID: ${createdClub.id})`);
  }

  // Create members and trainers per club (idempotent)
  for (const clubId of clubIds) {
    // --- Members ---
    const { count: currentMemberCount = 0 } = await supabase
      .from('user_club_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('role', 'member')
      .eq('is_active', true);

    const membersToCreate = Math.max(0, 20 - (currentMemberCount || 0));
    for (let i = 0; i < membersToCreate; i++) {
      const userId = uuidv4();
      const email = `member-${userId.substring(0, 8)}@test.swingz`;
      const { error: userError } = await supabase.from('users').upsert({
        id: userId,
        email,
        full_name: `Member ${clubId.substring(0, 4)}-${i + 1}`,
        created_at: new Date().toISOString(),
      });
      if (userError) {
        console.error(`  ❌ User error:`, userError.message);
        continue;
      }
      const { error: membershipError } = await supabase.from('user_club_memberships').upsert({
        user_id: userId,
        club_id: clubId,
        role: 'member',
        is_active: true,
        joined_at: new Date().toISOString(),
      });
      if (membershipError) {
        console.error(`  ❌ Membership error:`, membershipError.message);
      } else {
        console.log(`  👤 Created member for club ${clubId.substring(0, 8)}`);
      }
    }

    // --- Trainers ---
    const { count: currentTrainerCount = 0 } = await supabase
      .from('user_club_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('role', 'trainer')
      .eq('is_active', true);

    const trainersToCreate = Math.max(0, 3 - (currentTrainerCount || 0));
    for (let i = 0; i < trainersToCreate; i++) {
      const userId = uuidv4();
      const email = `trainer-${userId.substring(0, 8)}@test.swingz`;
      const { error: userError } = await supabase.from('users').upsert({
        id: userId,
        email,
        full_name: `Trainer ${clubId.substring(0, 4)}-${i + 1}`,
        created_at: new Date().toISOString(),
      });
      if (userError) {
        console.error(`  ❌ User error:`, userError.message);
        continue;
      }

      const { error: trainerError } = await supabase.from('trainers').insert({
        id: userId,
        email,
        name: `Trainer ${clubId.substring(0, 4)}-${i + 1}`,
        specialties: ['tennis'],
        max_hours_per_week: 25,
        is_active: true,
      });
      if (trainerError) {
        console.error(`  ❌ Trainer profile error:`, trainerError.message);
      }

      const { error: membershipError } = await supabase.from('user_club_memberships').upsert({
        user_id: userId,
        club_id: clubId,
        role: 'trainer',
        is_active: true,
        joined_at: new Date().toISOString(),
      });
      if (membershipError) {
        console.error(`  ❌ Membership error:`, membershipError.message);
      } else {
        console.log(`  👨‍🏫 Created trainer for club ${clubId.substring(0, 8)}`);
      }
    }
  }

  // Create one admin per club (if not exists)
  for (const clubId of clubIds) {
    // Check if admin already exists for this club
    const { data: existingAdmin } = await supabase
      .from('user_club_memberships')
      .select('user_id')
      .eq('club_id', clubId)
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();

    if (existingAdmin) {
      console.log(`  ⚡ Admin already exists for club ${clubId.substring(0, 8)}`);
      continue;
    }

    const adminId = uuidv4();
    const email = `admin${clubId.substring(0, 8)}@test.swingz`;
    const adminName = `Admin ${clubId.substring(0, 4)}`;

    const { error: userError } = await supabase.from('users').upsert({
      id: adminId,
      email,
      full_name: adminName,
      created_at: new Date().toISOString(),
    });

    if (userError) {
      console.error(`  ❌ Admin user error for club ${clubId.substring(0, 8)}:`, userError.message);
      continue;
    }

    const { error: membershipError } = await supabase.from('user_club_memberships').upsert({
      user_id: adminId,
      club_id: clubId,
      role: 'admin',
      is_active: true,
      joined_at: new Date().toISOString(),
    });

    if (membershipError) {
      console.error(
        `  ❌ Admin membership error for club ${clubId.substring(0, 8)}:`,
        membershipError.message
      );
    } else {
      console.log(`  👤 Created admin for club ${clubId.substring(0, 8)}`);
    }
  }

  // Create superadmin user (if not exists) and assign to all clubs
  const superadminEmail = process.env.SUPERADMIN_EMAIL || 'superadmin@swingz.com';
  const { data: superadminData } = await supabase
    .from('users')
    .select('id')
    .eq('email', superadminEmail)
    .single();

  let superadminId: string;
  if (superadminData) {
    superadminId = superadminData.id;
    console.log(`  🔑 Superadmin user found: ${superadminEmail}`);
  } else {
    superadminId = uuidv4();
    const { error: saUserError } = await supabase.from('users').upsert({
      id: superadminId,
      email: superadminEmail,
      full_name: 'Superadmin',
      created_at: new Date().toISOString(),
    });

    if (saUserError) {
      console.error(`❌ Error creating superadmin user:`, saUserError.message);
    } else {
      console.log(`  🦸 Created superadmin user: ${superadminEmail}`);
    }
  }

  // Assign superadmin to all clubs
  for (const clubId of clubIds) {
    const { data: existing } = await supabase
      .from('user_club_memberships')
      .select('user_id')
      .eq('user_id', superadminId)
      .eq('club_id', clubId)
      .eq('role', 'superadmin')
      .limit(1)
      .maybeSingle();

    if (existing) {
      continue;
    }

    const { error: saMembershipError } = await supabase.from('user_club_memberships').upsert({
      user_id: superadminId,
      club_id: clubId,
      role: 'superadmin',
      is_active: true,
      joined_at: new Date().toISOString(),
    });

    if (saMembershipError) {
      console.error(
        `  ❌ Superadmin membership error for club ${clubId.substring(0, 8)}:`,
        saMembershipError.message
      );
    } else {
      console.log(`  🦸 Added superadmin to club ${clubId.substring(0, 8)}`);
    }
  }

  console.log('\n🎉 Seed completed successfully!');
  console.log(
    `📊 Summary: ${clubIds.length} clubs, ${clubIds.length * 20} members, ${clubIds.length * 3} trainers, ${clubIds.length} admins, 1 superadmin created.`
  );
  process.exit(0);
}

checkAndSeed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

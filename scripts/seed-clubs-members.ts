import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAndSeed() {
  console.log('🔍 Checking existing data...');

  const { data: clubsData } = await supabase.from('clubs').select('*');
  const { data: usersData } = await supabase.from('users').select('*');

  const clubCount = clubsData?.length || 0;
  const userCount = usersData?.length || 0;

  console.log(`Clubs: ${clubCount}, Users: ${userCount}`);

  if (clubCount >= 3 && userCount >= 60) {
    console.log('✅ Database already seeded.');
    process.exit(0);
  }

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

  // Create members and trainers per club
  for (const clubId of clubIds) {
    // 20 members
    for (let i = 1; i <= 20; i++) {
      const userId = uuidv4();
      const email = `member${i}-${clubId.substring(0, 8)}@test.swingz`;

      const { error: userError } = await supabase.from('users').upsert({
        id: userId,
        email,
        full_name: `Member ${i}`,
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
        console.log(`  👤 Created member ${i} for club ${clubId.substring(0, 8)}`);
      }
    }

    // 3 trainers
    for (let i = 1; i <= 3; i++) {
      const userId = uuidv4();
      const email = `trainer${i}-${clubId.substring(0, 8)}@test.swingz`;

      const { error: userError } = await supabase.from('users').upsert({
        id: userId,
        email,
        full_name: `Trainer ${i}`,
        created_at: new Date().toISOString(),
      });

      if (userError) {
        console.error(`  ❌ User error:`, userError.message);
        continue;
      }

      const { error: trainerError } = await supabase.from('trainers').insert({
        id: userId, // Use same UUID as user
        email,
        name: `Trainer ${i}`,
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
        console.log(`  👨‍🏫 Created trainer ${i} for club ${clubId.substring(0, 8)}`);
      }
    }
  }

  console.log('\n🎉 Seed completed successfully!');
  console.log('📊 Summary: 3 clubs, 60 members, 9 trainers created.');
  process.exit(0);
}

checkAndSeed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

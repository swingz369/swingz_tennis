import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seed() {
  console.log('🌱 Starting seed...');

  const clubs = [
    { name: 'Tennis Club Berlin', location: 'Berlin' },
    { name: 'Squash Club Munich', location: 'Munich' },
    { name: 'Badminton Club Hamburg', location: 'Hamburg' },
  ];

  const clubIds: string[] = [];

  // Create clubs
  for (const club of clubs) {
    const { data: createdClub, error } = await supabase
      .from('clubs')
      .insert({
        name: club.name,
        location: club.location,
        max_members: 100,
        status: 'active',
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

    if (error) {
      console.error(`Error creating club ${club.name}:`, error);
      continue;
    }

    clubIds.push(createdClub.id);
    console.log(`✅ Created club: ${club.name} (${createdClub.id})`);
  }

  // Create members and trainers for each club
  for (const clubId of clubIds) {
    // Create 20 members per club
    for (let i = 0; i < 20; i++) {
      const memberNumber = i + 1;
      const userId = `member-${clubId}-${memberNumber}`;

      const { error: userError } = await supabase.from('users').upsert({
        id: userId,
        email: `member${memberNumber}@${clubId.substring(0, 8)}.test`,
        full_name: `Member ${memberNumber}`,
        first_name: `Member${memberNumber}`,
        last_name: `Test`,
        created_at: new Date().toISOString(),
      });

      if (userError) {
        console.error(`Error creating user ${userId}:`, userError);
        continue;
      }

      const { error: membershipError } = await supabase.from('user_club_memberships').upsert({
        user_id: userId,
        club_id: clubId,
        role: 'member',
        is_active: true,
        membership_start: new Date().toISOString(),
      });

      if (membershipError) {
        console.error(`Error creating membership for ${userId}:`, membershipError);
      } else {
        console.log(`  👤 Created member: ${userId}`);
      }
    }

    // Create 3 trainers per club
    for (let i = 0; i < 3; i++) {
      const trainerNumber = i + 1;
      const userId = `trainer-${clubId}-${trainerNumber}`;

      const { error: userError } = await supabase.from('users').upsert({
        id: userId,
        email: `trainer${trainerNumber}@${clubId.substring(0, 8)}.test`,
        full_name: `Trainer ${trainerNumber}`,
        first_name: `Trainer${trainerNumber}`,
        last_name: `Test`,
        created_at: new Date().toISOString(),
      });

      if (userError) {
        console.error(`Error creating trainer ${userId}:`, userError);
        continue;
      }

      const { error: membershipError } = await supabase.from('user_club_memberships').upsert({
        user_id: userId,
        club_id: clubId,
        role: 'trainer',
        is_active: true,
        membership_start: new Date().toISOString(),
      });

      if (membershipError) {
        console.error(`Error creating membership for trainer ${userId}:`, membershipError);
      } else {
        console.log(`  👨‍🏫 Created trainer: ${userId}`);
      }
    }

    // Also create 1 admin per club
    const adminId = `admin-${clubId}-1`;
    const { error: adminUserError } = await supabase.from('users').upsert({
      id: adminId,
      email: `admin@${clubId.substring(0, 8)}.test`,
      full_name: `${clubs.find((c) => c.id === clubId)?.name} Admin`,
      first_name: 'Admin',
      last_name: 'User',
      created_at: new Date().toISOString(),
    });

    if (!adminUserError) {
      await supabase.from('user_club_memberships').upsert({
        user_id: adminId,
        club_id: clubId,
        role: 'admin',
        is_active: true,
        membership_start: new Date().toISOString(),
      });
      console.log(`  👑 Created admin: ${adminId}`);
    }
  }

  console.log('✨ Seed completed!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

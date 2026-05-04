import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seedTrainers() {
  console.log('🌱 Seeding trainer profiles...');

  // Get all users with trainer role
  const { data: trainerMemberships, error } = await supabase
    .from('user_club_memberships')
    .select('user_id, club_id')
    .eq('role', 'trainer');

  if (error) {
    console.error('❌ Error fetching trainer memberships:', error.message);
    process.exit(1);
  }

  console.log(`Found ${trainerMemberships?.length || 0} trainer memberships`);

  // Create trainer profiles (one per user, deduplicated)
  const processedUserIds = new Set<string>();

  for (const membership of trainerMemberships || []) {
    const userId = membership.user_id;

    if (processedUserIds.has(userId)) continue;
    processedUserIds.add(userId);

    // Check if trainer already exists
    const { data: existing } = await supabase
      .from('trainers')
      .select('id')
      .eq('id', userId)
      .single();

    if (existing) {
      console.log(`  ✓ Trainer ${userId.substring(0, 8)} already exists`);
      continue;
    }

    // Create trainer profile with same UUID as user
    const { error: insertError } = await supabase.from('trainers').insert({
      id: userId,
      email: `${userId.substring(0, 8)}@trainer.swingz`,
      name: `Trainer ${userId.substring(0, 8)}`,
      specialties: ['tennis', 'beginner'],
      max_hours_per_week: 20,
      is_active: true,
    });

    if (insertError) {
      console.error(`  ❌ Error creating trainer ${userId.substring(0, 8)}:`, insertError.message);
    } else {
      console.log(`  ✅ Created trainer: ${userId.substring(0, 8)}`);
    }
  }

  console.log('\n🎉 Trainer seeding completed!');
  process.exit(0);
}

seedTrainers().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});

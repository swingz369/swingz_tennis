import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const [
    { count: clubCount },
    { count: userCount },
    { count: trainerCount },
    { count: membershipCount },
  ] = await Promise.all([
    supabase.from('clubs').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('trainers').select('*', { count: 'exact', head: true }),
    supabase.from('user_club_memberships').select('*', { count: 'exact', head: true }),
  ]);

  console.log('📊 Database Summary:');
  console.log(`   Clubs: ${clubCount}`);
  console.log(`   Users: ${userCount}`);
  console.log(`   Trainers: ${trainerCount}`);
  console.log(`   Memberships: ${membershipCount}`);

  // Check role distribution
  const { data: roles } = await supabase.from('user_club_memberships').select('role').limit(1000);

  const roleCounts = roles?.reduce(
    (acc, r) => {
      acc[r.role] = (acc[r.role] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log('   Roles:', roleCounts);

  process.exit(0);
}

check().catch(console.error);

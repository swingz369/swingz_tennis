import 'dotenv/config';
import { createServiceClient } from '@/lib/supabase/service';

const supabase = createServiceClient();

async function checkTables() {
  // Check which Drizzle schema tables exist in production
  const tablesToCheck = [
    'seasons',
    'user_training_preferences',
    'season_plan_entries',
    'planning_conflicts',
    'booking_conflicts',
    'club_schedule_patterns',
    'feedback',
  ];

  console.log('Checking production tables...\n');

  for (const table of tablesToCheck) {
    const { data, error } = await supabase.from(table).select('*').limit(1);

    if (error) {
      console.log(`❌ ${table}: ${error.message}`);
    } else {
      console.log(`✅ ${table}: exists (${data?.length || 0} rows)`);
    }
  }

  // Also check for user with superadmin role
  console.log('\nChecking admin user...');
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'admin@swingz.com')
    .single();

  if (user) {
    const { data: memberships } = await supabase
      .from('user_club_memberships')
      .select('role, clubs(name)')
      .eq('user_id', user.id);

    console.log('Admin memberships:', JSON.stringify(memberships, null, 2));
  }
}

checkTables().catch(console.error);

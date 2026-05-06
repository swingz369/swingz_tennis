import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qeckztuzeymuwwtyoryi.supabase.co';
const supabaseServiceKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlY2t6dHV6ZXltdXd3dHlvcnlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM0NzY0MiwiZXhwIjoyMDkyOTIzNjQyfQ.SCZbiLKSio02oC4rlQ8fpuLL_9MTnXEAVl86Ra1fzDA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

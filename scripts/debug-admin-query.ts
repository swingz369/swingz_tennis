import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugAdminQuery() {
  console.log('\n🔍 Debug: Checking admin query...\n');

  const clubId = '30b0d39d-a152-4d2d-bd57-d23220794d41';

  // Try different queries
  console.log('Query 1: Get all memberships for club (no filter)');
  const { data: all, error: err1 } = await supabase
    .from('user_club_memberships')
    .select('id, user_id, role, is_active, users(email)')
    .eq('club_id', clubId);

  console.log('Result:', all);
  console.log('Error:', err1);

  console.log('\n---\n');

  console.log('Query 2: Get admin memberships (role = "admin")');
  const { data: admins, error: err2 } = await supabase
    .from('user_club_memberships')
    .select('id, user_id, role, is_active, users(email)')
    .eq('club_id', clubId)
    .eq('role', 'admin');

  console.log('Result:', admins);
  console.log('Error:', err2);

  console.log('\n---\n');

  console.log('Query 3: Get all roles for this club');
  const { data: roles, error: _err3 } = await supabase
    .from('user_club_memberships')
    .select('role')
    .eq('club_id', clubId);

  console.log('Unique roles:', [...new Set(roles?.map((r) => r.role))]);
}

debugAdminQuery();

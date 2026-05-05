import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  // Check for public.users table
  const { data, error } = await supabase.from('users').select('id, email, full_name').limit(1);

  if (error) {
    console.log('❌ No public.users table:', error.message);
  } else {
    console.log('✓ public.users table exists');
    console.log('Sample:', data);
  }
}

check()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

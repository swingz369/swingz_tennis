import 'dotenv/config';
import { createServiceClient } from '@/lib/supabase/service';

const supabase = createServiceClient();

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

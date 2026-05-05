import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

console.log('URL:', supabaseUrl);
console.log('Key:', serviceKey ? 'present' : 'missing');

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function listClubs() {
  const { data: clubs, error } = await supabase.from('clubs').select('id, name').order('name');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\nClubs:');
  console.log(JSON.stringify(clubs, null, 2));
}

listClubs()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });

import 'dotenv/config';
import { createServiceClient } from '@/lib/supabase/service';

const supabase = createServiceClient();

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

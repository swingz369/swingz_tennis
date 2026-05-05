import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function updatePassword() {
  const {
    data: { users },
  } = await supabase.auth.admin.listUsers({ email: 'admin@swingz.com' });
  if (users && users.length > 0) {
    const userId = users[0].id;
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: 'AdminPass123!',
    });
    if (error) {
      console.error('Error:', error);
      process.exit(1);
    } else {
      console.log('Password updated successfully for admin@swingz.com');
    }
  } else {
    console.error('User not found');
    process.exit(1);
  }
}

updatePassword();

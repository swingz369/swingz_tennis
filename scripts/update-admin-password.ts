import { createServiceClient } from '@/lib/supabase/service';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createServiceClient();

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

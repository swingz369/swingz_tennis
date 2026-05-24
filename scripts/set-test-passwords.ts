import { createServiceClient } from '@/lib/supabase/service';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createServiceClient();

const users = [
  { email: 'admin@swingz.com', password: 'AdminPass123!' },
  { email: 'superadmin@swingz.com', password: 'SuperadminPass123!' },
  { email: 'member@swingz.com', password: 'MemberPass123!' },
  { email: 'trainer@swingz.com', password: 'TrainerPass123!' },
];

async function setPasswords() {
  for (const { email, password } of users) {
    const {
      data: { users: found },
    } = await supabase.auth.admin.listUsers({ email });
    if (found && found.length > 0) {
      const { error } = await supabase.auth.admin.updateUserById(found[0].id, { password });
      if (error) {
        console.error(`❌ ${email}:`, error.message);
      } else {
        console.log(`✅ ${email}: password set`);
      }
    } else {
      console.error(`❌ ${email}: user not found`);
    }
  }
}

setPasswords();

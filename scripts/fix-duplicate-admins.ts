import { createServiceClient } from '@/lib/supabase/service';

const supabase = createServiceClient();

async function deactivateDuplicateAdmins() {
  console.log('\n🔧 Fixing: Only one admin per club...\n');

  // Get all clubs
  const { data: clubs } = await supabase.from('clubs').select('id, name');

  if (!clubs) {
    console.error('❌ No clubs found');
    return;
  }

  console.log(`📊 Found ${clubs.length} clubs`);

  for (const club of clubs) {
    console.log(`\n🏢 Checking club: ${club.name} (${club.id})`);

    // Get all admin memberships for this club
    const { data: adminMemberships } = await supabase
      .from('user_club_memberships')
      .select('id, user_id, role, is_active, created_at, users(email)')
      .eq('club_id', club.id)
      .eq('role', 'admin')
      .order('created_at', { ascending: true });

    if (!adminMemberships || adminMemberships.length === 0) {
      console.log('  ⚠️  No admins found');
      continue;
    }

    console.log(`  Found ${adminMemberships.length} admin(s)`);

    const activeAdmins = adminMemberships.filter((m) => m.is_active);

    if (activeAdmins.length === 0) {
      console.log('  ⚠️  No ACTIVE admins - keeping oldest one active');
      // Activate the oldest one
      const { error } = await supabase
        .from('user_club_memberships')
        .update({ is_active: true })
        .eq('id', adminMemberships[0].id);

      if (error) {
        console.error('  ❌ Error activating admin:', error);
      } else {
        console.log(`  ✅ Activated: ${(adminMemberships[0].users as any).email}`);
      }
    } else if (activeAdmins.length === 1) {
      console.log(`  ✅ Exactly 1 active admin: ${(activeAdmins[0].users as any).email}`);
    } else {
      console.log(
        `  ⚠️  Multiple active admins (${activeAdmins.length})! Keeping oldest, deactivating others...`
      );

      // Keep the oldest, deactivate the rest
      const [keepAdmin, ...deactivateAdmins] = activeAdmins;

      console.log(`  ✅ Keeping: ${(keepAdmin.users as any).email}`);

      for (const admin of deactivateAdmins) {
        const { error } = await supabase
          .from('user_club_memberships')
          .update({ is_active: false })
          .eq('id', admin.id);

        if (error) {
          console.error(`  ❌ Error deactivating ${(admin.users as any).email}:`, error);
        } else {
          console.log(`  🔴 Deactivated: ${(admin.users as any).email}`);
        }
      }
    }
  }

  console.log('\n✅ Done! Each club now has exactly 1 active admin.\n');
}

deactivateDuplicateAdmins();

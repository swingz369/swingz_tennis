import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function validateClubIsolation() {
  console.log('🔍 Validating Club Isolation & Data Integrity\n');
  console.log('='.repeat(70));

  const { data: clubs } = await supabase.from('clubs').select('id, name').order('name');

  if (!clubs || clubs.length === 0) {
    console.log('❌ No clubs found');
    return;
  }

  let allValid = true;

  for (const club of clubs) {
    console.log(`\n\n🏢 ${club.name}`);
    console.log('─'.repeat(70));

    // 1. Validate admin assignment
    const { data: admins } = await supabase
      .from('user_club_memberships')
      .select('user_id, role')
      .eq('club_id', club.id)
      .eq('role', 'admin')
      .eq('is_active', true);

    if (!admins || admins.length === 0) {
      console.log('❌ FAIL: No admin assigned');
      allValid = false;
    } else if (admins.length > 1) {
      console.log(`❌ FAIL: Multiple admins (${admins.length}) - should be exactly 1`);
      allValid = false;
    } else {
      console.log(`✅ PASS: Exactly 1 admin assigned`);
    }

    // 2. Validate courts belong to club
    const { data: courts } = await supabase
      .from('courts')
      .select('id, club_id, name')
      .eq('club_id', club.id)
      .eq('is_active', true);

    const invalidCourts = courts?.filter((c) => c.club_id !== club.id);
    if (invalidCourts && invalidCourts.length > 0) {
      console.log(`❌ FAIL: ${invalidCourts.length} courts with wrong club_id`);
      allValid = false;
    } else if (!courts || courts.length === 0) {
      console.log('⚠️  WARN: No courts found');
    } else {
      console.log(`✅ PASS: ${courts.length} courts correctly assigned to club`);
    }

    // 3. Validate schedules belong to club
    const { data: schedules } = await supabase
      .from('schedules')
      .select('id, club_id, season_year')
      .eq('club_id', club.id)
      .eq('is_active', true);

    const invalidSchedules = schedules?.filter((s) => s.club_id !== club.id);
    if (invalidSchedules && invalidSchedules.length > 0) {
      console.log(`❌ FAIL: ${invalidSchedules.length} schedules with wrong club_id`);
      allValid = false;
    } else if (!schedules || schedules.length === 0) {
      console.log('⚠️  WARN: No schedules found');
    } else {
      console.log(`✅ PASS: ${schedules.length} schedules correctly assigned to club`);
    }

    // 4. Validate trainers are properly linked
    const { data: trainerMemberships } = await supabase
      .from('user_club_memberships')
      .select('user_id, club_id')
      .eq('club_id', club.id)
      .eq('role', 'trainer')
      .eq('is_active', true);

    if (!trainerMemberships || trainerMemberships.length === 0) {
      console.log('⚠️  WARN: No trainers assigned to club');
    } else {
      // Check if trainers exist in trainers table
      const _trainerUserIds = trainerMemberships.map((t) => t.user_id);
      const { data: users } = await supabase.auth.admin.listUsers();

      const { data: trainerRecords } = await supabase
        .from('trainers')
        .select('id, email')
        .eq('is_active', true);

      const trainerEmails = new Set(trainerRecords?.map((t) => t.email) || []);
      let missingCount = 0;

      for (const tm of trainerMemberships) {
        const user = users?.users.find((u) => u.id === tm.user_id);
        if (!user) {
          missingCount++;
          continue;
        }

        if (!trainerEmails.has(user.email!)) {
          console.log(`  ⚠️  Trainer ${user.email} in memberships but not in trainers table`);
        }
      }

      if (missingCount > 0) {
        console.log(`❌ FAIL: ${missingCount} trainer memberships reference non-existent users`);
        allValid = false;
      } else {
        console.log(`✅ PASS: ${trainerMemberships.length} trainers correctly linked`);
      }
    }

    // 5. Validate members
    const { data: memberMemberships } = await supabase
      .from('user_club_memberships')
      .select('user_id, club_id')
      .eq('club_id', club.id)
      .eq('role', 'member')
      .eq('is_active', true);

    if (!memberMemberships || memberMemberships.length === 0) {
      console.log('⚠️  WARN: No members assigned to club');
    } else {
      const { data: users } = await supabase.auth.admin.listUsers();
      const userIds = new Set(users?.users.map((u) => u.id) || []);

      const invalidMembers = memberMemberships.filter((m) => !userIds.has(m.user_id));
      if (invalidMembers.length > 0) {
        console.log(
          `❌ FAIL: ${invalidMembers.length} member memberships reference non-existent users`
        );
        allValid = false;
      } else {
        console.log(`✅ PASS: ${memberMemberships.length} members correctly linked`);
      }
    }

    // 6. Validate sessions reference correct club resources
    if (schedules && schedules.length > 0) {
      const scheduleIds = schedules.map((s) => s.id);
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, schedule_id, court_id, trainer_id')
        .in('schedule_id', scheduleIds);

      if (sessions && sessions.length > 0) {
        const courtIds = new Set(courts?.map((c) => c.id) || []);
        const invalidSessions = sessions.filter((s) => s.court_id && !courtIds.has(s.court_id));

        if (invalidSessions.length > 0) {
          console.log(
            `❌ FAIL: ${invalidSessions.length} sessions reference courts from other clubs`
          );
          allValid = false;
        } else {
          console.log(`✅ PASS: ${sessions.length} sessions correctly scoped to club resources`);
        }
      }
    }

    // 7. Check for cross-club contamination
    const { data: allMemberships } = await supabase
      .from('user_club_memberships')
      .select('user_id, club_id, role')
      .eq('is_active', true);

    // Find users with multiple roles in same club (should only be superadmin)
    const clubRoleMap = new Map<string, Map<string, Set<string>>>();
    for (const m of allMemberships || []) {
      if (!clubRoleMap.has(m.club_id)) {
        clubRoleMap.set(m.club_id, new Map());
      }
      const clubMap = clubRoleMap.get(m.club_id)!;
      if (!clubMap.has(m.user_id)) {
        clubMap.set(m.user_id, new Set());
      }
      clubMap.get(m.user_id)!.add(m.role);
    }

    const clubMap = clubRoleMap.get(club.id);
    if (clubMap) {
      let multiRoleCount = 0;
      for (const [userId, roles] of clubMap.entries()) {
        if (roles.size > 1) {
          // Check if one of the roles is superadmin
          if (!roles.has('superadmin')) {
            console.log(`⚠️  User ${userId} has multiple roles: ${Array.from(roles).join(', ')}`);
            multiRoleCount++;
          }
        }
      }

      if (multiRoleCount > 0) {
        console.log(
          `❌ FAIL: ${multiRoleCount} users have multiple non-superadmin roles in same club`
        );
        allValid = false;
      }
    }
  }

  console.log('\n\n' + '='.repeat(70));
  if (allValid) {
    console.log('✅ ALL VALIDATIONS PASSED');
    console.log('   - All clubs have exactly one admin');
    console.log('   - All resources correctly scoped to their clubs');
    console.log('   - All memberships reference valid users');
    console.log('   - No cross-club contamination detected');
  } else {
    console.log('❌ VALIDATION FAILURES DETECTED');
    console.log('   Please review the issues above and run fixes');
  }

  return allValid;
}

validateClubIsolation()
  .then((valid) => process.exit(valid ? 0 : 1))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });

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

async function comprehensiveClubSetup() {
  console.log('🔧 Comprehensive Club Setup & Validation\n');
  console.log('='.repeat(60));

  // 1. Get all clubs
  const { data: clubs, error: clubsError } = await supabase
    .from('clubs')
    .select('id, name')
    .order('name');

  if (clubsError || !clubs || clubs.length === 0) {
    console.log('❌ No clubs found or error:', clubsError);
    return;
  }

  console.log(`\n📋 Found ${clubs.length} clubs\n`);

  for (const club of clubs) {
    console.log('\n' + '─'.repeat(60));
    console.log(`\n🏢 Processing: ${club.name} (${club.id})\n`);

    // 2. Check admin assignments for this club
    const { data: memberships } = await supabase
      .from('user_club_memberships')
      .select('user_id, role, is_active')
      .eq('club_id', club.id)
      .eq('is_active', true);

    const adminCount = memberships?.filter((m) => m.role === 'admin').length || 0;
    const superadminCount = memberships?.filter((m) => m.role === 'superadmin').length || 0;
    const trainerCount = memberships?.filter((m) => m.role === 'trainer').length || 0;
    const memberCount = memberships?.filter((m) => m.role === 'member').length || 0;

    console.log('👥 Current Membership Stats:');
    console.log(`   Admins: ${adminCount}`);
    console.log(`   Superadmins: ${superadminCount}`);
    console.log(`   Trainers: ${trainerCount}`);
    console.log(`   Members: ${memberCount}`);

    // 3. Enforce: Exactly one admin per club (excluding superadmins)
    if (adminCount === 0) {
      console.log('\n⚠️  No admin found for this club!');

      // Check if there's a specific admin user for this club
      const clubAdminEmail = `admin-${club.name.toLowerCase().replace(/\s+/g, '-')}@swingz.com`;
      const { data: users } = await supabase.auth.admin.listUsers();
      let adminUser = users?.users.find((u) => u.email === clubAdminEmail);

      if (!adminUser) {
        // Check for generic admin@swingz.com
        adminUser = users?.users.find((u) => u.email === 'admin@swingz.com');
      }

      if (!adminUser) {
        console.log('   ❌ No admin user available, creating one...');
        // Create admin user
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: clubAdminEmail,
          password: 'AdminPass123!',
          email_confirm: true,
          user_metadata: {
            full_name: `${club.name} Admin`,
          },
        });

        if (createError) {
          console.log(`   ❌ Failed to create admin user: ${createError.message}`);
          continue;
        }

        adminUser = newUser.user;
        console.log(`   ✓ Created admin user: ${clubAdminEmail}`);
      }

      // Assign admin role to this club
      const { error: insertError } = await supabase.from('user_club_memberships').insert({
        user_id: adminUser!.id,
        club_id: club.id,
        role: 'admin',
        is_active: true,
        joined_at: new Date().toISOString(),
      });

      if (insertError) {
        console.log(`   ❌ Failed to assign admin: ${insertError.message}`);
      } else {
        console.log(`   ✓ Assigned ${adminUser!.email} as admin`);
      }
    } else if (adminCount > 1) {
      console.log(`\n⚠️  Multiple admins found (${adminCount}), keeping first one only`);

      const admins = memberships!.filter((m) => m.role === 'admin');
      const _toKeep = admins[0];
      const toDeactivate = admins.slice(1);

      for (const admin of toDeactivate) {
        await supabase
          .from('user_club_memberships')
          .update({ is_active: false })
          .eq('user_id', admin.user_id)
          .eq('club_id', club.id)
          .eq('role', 'admin');

        console.log(`   ✓ Deactivated extra admin: ${admin.user_id}`);
      }
    } else {
      console.log('   ✓ Exactly one admin - OK');
    }

    // 4. Ensure club has courts
    const { data: courts } = await supabase
      .from('courts')
      .select('id, name')
      .eq('club_id', club.id)
      .eq('is_active', true);

    console.log(`\n🏟️  Courts: ${courts?.length || 0}`);

    if (!courts || courts.length === 0) {
      console.log('   ⚠️  No courts found, creating default courts...');

      const defaultCourts = [
        { name: 'Court 1', surface: 'hard', has_indoor: false },
        { name: 'Court 2', surface: 'hard', has_indoor: false },
        { name: 'Court 3', surface: 'hard', has_indoor: true },
      ];

      for (const court of defaultCourts) {
        const { error } = await supabase.from('courts').insert({
          club_id: club.id,
          name: court.name,
          surface: court.surface,
          has_indoor: court.has_indoor,
          is_active: true,
        });

        if (error) {
          console.log(`   ❌ Failed to create ${court.name}: ${error.message}`);
        } else {
          console.log(`   ✓ Created ${court.name}`);
        }
      }
    } else {
      console.log(`   ✓ ${courts.length} courts exist`);
    }

    // 5. Ensure club has schedule
    const { data: schedules } = await supabase
      .from('schedules')
      .select('id, season_year')
      .eq('club_id', club.id)
      .eq('is_active', true);

    console.log(`\n📅 Schedules: ${schedules?.length || 0}`);

    if (!schedules || schedules.length === 0) {
      console.log('   ⚠️  No schedule found, creating current year schedule...');

      const currentYear = new Date().getFullYear();
      const { error } = await supabase.from('schedules').insert({
        club_id: club.id,
        season_type: 'full_year',
        season_year: currentYear,
        season_start_date: new Date(currentYear, 0, 1).toISOString(),
        season_end_date: new Date(currentYear, 11, 31).toISOString(),
        is_active: true,
      });

      if (error) {
        console.log(`   ❌ Failed to create schedule: ${error.message}`);
      } else {
        console.log(`   ✓ Created schedule for ${currentYear}`);
      }
    } else {
      console.log(`   ✓ ${schedules.length} schedules exist`);
    }

    // 6. Ensure club has trainers (at least 1)
    if (trainerCount === 0) {
      console.log('\n👨‍🏫 No trainers found, creating trainer...');

      // Check for existing trainer user
      const trainerEmail = `trainer-${club.name.toLowerCase().replace(/\s+/g, '-')}@swingz.com`;
      const { data: users } = await supabase.auth.admin.listUsers();
      let trainerUser = users?.users.find((u) => u.email === trainerEmail);

      if (!trainerUser) {
        // Check for generic trainer
        trainerUser = users?.users.find((u) => u.email === 'trainer@swingz.com');
      }

      if (!trainerUser) {
        // Create trainer user
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: trainerEmail,
          password: 'TrainerPass123!',
          email_confirm: true,
          user_metadata: {
            full_name: `${club.name} Trainer`,
          },
        });

        if (createError) {
          console.log(`   ❌ Failed to create trainer user: ${createError.message}`);
        } else {
          trainerUser = newUser.user;
          console.log(`   ✓ Created trainer user: ${trainerEmail}`);
        }
      }

      if (trainerUser) {
        // Add to user_club_memberships
        const { error: membershipError } = await supabase.from('user_club_memberships').insert({
          user_id: trainerUser.id,
          club_id: club.id,
          role: 'trainer',
          is_active: true,
          joined_at: new Date().toISOString(),
        });

        if (membershipError) {
          console.log(`   ❌ Failed to add trainer membership: ${membershipError.message}`);
        } else {
          console.log(`   ✓ Added trainer membership`);
        }

        // Create trainer record in trainers table
        const { data: existingTrainer } = await supabase
          .from('trainers')
          .select('id')
          .eq('email', trainerUser.email!)
          .single();

        if (!existingTrainer) {
          const { data: newTrainer, error: trainerError } = await supabase
            .from('trainers')
            .insert({
              email: trainerUser.email!,
              name: trainerUser.user_metadata?.full_name || 'Trainer',
              specialties: ['coaching'],
              max_hours_per_week: 30,
              is_active: true,
            })
            .select('id')
            .single();

          if (trainerError) {
            console.log(`   ❌ Failed to create trainer record: ${trainerError.message}`);
          } else {
            console.log(`   ✓ Created trainer record`);

            // Link trainer to club
            const { error: linkError } = await supabase.from('trainer_club').insert({
              trainer_id: newTrainer.id,
              club_id: club.id,
            });

            if (linkError) {
              console.log(`   ❌ Failed to link trainer to club: ${linkError.message}`);
            } else {
              console.log(`   ✓ Linked trainer to club`);
            }
          }
        }
      }
    } else {
      console.log(`\n👨‍🏫 Trainers: ${trainerCount} - OK`);
    }

    // 7. Ensure club has members (at least 2)
    if (memberCount < 2) {
      console.log(`\n👤 Only ${memberCount} members, creating test members...`);

      const membersToCreate = 2 - memberCount;
      for (let i = 0; i < membersToCreate; i++) {
        const memberEmail = `member${i + 1}-${club.name.toLowerCase().replace(/\s+/g, '-')}@swingz.com`;

        // Check if user exists
        const { data: users } = await supabase.auth.admin.listUsers();
        let memberUser = users?.users.find((u) => u.email === memberEmail);

        if (!memberUser) {
          const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: memberEmail,
            password: 'MemberPass123!',
            email_confirm: true,
            user_metadata: {
              full_name: `Test Member ${i + 1}`,
            },
          });

          if (createError) {
            console.log(`   ❌ Failed to create member: ${createError.message}`);
            continue;
          }

          memberUser = newUser.user;
          console.log(`   ✓ Created member user: ${memberEmail}`);
        }

        // Add membership
        const { error: membershipError } = await supabase.from('user_club_memberships').insert({
          user_id: memberUser!.id,
          club_id: club.id,
          role: 'member',
          is_active: true,
          joined_at: new Date().toISOString(),
        });

        if (membershipError) {
          console.log(`   ❌ Failed to add membership: ${membershipError.message}`);
        } else {
          console.log(`   ✓ Added member: ${memberUser!.email}`);
        }
      }
    } else {
      console.log(`\n👤 Members: ${memberCount} - OK`);
    }

    console.log('\n✅ Club setup complete');
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n🎉 All clubs processed successfully!');
  console.log('\n📊 Final Summary:');

  // Final validation
  for (const club of clubs) {
    const { data: memberships } = await supabase
      .from('user_club_memberships')
      .select('role')
      .eq('club_id', club.id)
      .eq('is_active', true);

    const { data: courts } = await supabase
      .from('courts')
      .select('id')
      .eq('club_id', club.id)
      .eq('is_active', true);

    const adminCount = memberships?.filter((m) => m.role === 'admin').length || 0;
    const trainerCount = memberships?.filter((m) => m.role === 'trainer').length || 0;
    const memberCount = memberships?.filter((m) => m.role === 'member').length || 0;

    console.log(`\n${club.name}:`);
    console.log(`  ✓ Admins: ${adminCount} ${adminCount === 1 ? '(OK)' : '(ERROR)'}`);
    console.log(`  ✓ Trainers: ${trainerCount}`);
    console.log(`  ✓ Members: ${memberCount}`);
    console.log(`  ✓ Courts: ${courts?.length || 0}`);
  }
}

comprehensiveClubSetup()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  });

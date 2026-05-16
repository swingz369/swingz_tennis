#!/usr/bin/env tsx
/**
 * Execute SQL directly in Supabase
 */

import { createClient } from '@supabase/supabase-js';

async function executeSql() {
  const supabaseUrl = 'https://qeckztuzeymuwwtyoryi.supabase.co';
  const supabaseServiceKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlY2t6dHV6ZXltdXd3dHlvcnlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM0NzY0MiwiZXhwIjoyMDkyOTIzNjQyfQ.SCZbiLKSio02oC4rlQ8fpuLL_9MTnXEAVl86Ra1fzDA';

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🚀 Setting up admin membership via SQL...\n');

  try {
    // First, get the user ID
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const adminUser = authUsers?.users?.find((u) => u.email === 'admin@swingz.com');

    if (!adminUser) {
      console.error('❌ Admin user not found in auth.users');
      process.exit(1);
    }

    console.log('✅ Found admin user:', adminUser.id);

    // Get first club or create one
    let club;
    const { data: existingClubs } = await supabase.from('clubs').select('*').limit(1);

    if (existingClubs && existingClubs.length > 0) {
      club = existingClubs[0];
      console.log('✅ Using existing club:', club.name);
    } else {
      // Create demo club with required opening_hours
      const { data: newClub, error: clubError } = await supabase
        .from('clubs')
        .insert({
          name: 'Demo Tennis Club',
          status: 'active',
          max_members: 500,
          opening_hours: {
            monday: { open: '08:00', close: '22:00' },
            tuesday: { open: '08:00', close: '22:00' },
            wednesday: { open: '08:00', close: '22:00' },
            thursday: { open: '08:00', close: '22:00' },
            friday: { open: '08:00', close: '22:00' },
            saturday: { open: '09:00', close: '20:00' },
            sunday: { open: '09:00', close: '20:00' },
          },
          default_hourly_rate: '15.00',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (clubError) {
        console.error('❌ Club error:', clubError);
        process.exit(1);
      }

      club = newClub;
      console.log('✅ Club created:', club.name);
    }

    console.log('✅ Club ready:', club.id);

    // Check if membership exists
    const { data: existingMembership } = await supabase
      .from('user_club_memberships')
      .select('*')
      .eq('user_id', adminUser.id)
      .eq('club_id', club.id)
      .single();

    if (existingMembership) {
      // Update existing
      const { error: updateError } = await supabase
        .from('user_club_memberships')
        .update({
          role: 'superadmin',
          is_active: true,
        })
        .eq('user_id', adminUser.id)
        .eq('club_id', club.id);

      if (updateError) {
        console.error('❌ Update error:', updateError);
        process.exit(1);
      }
      console.log('✅ Membership updated to superadmin!');
    } else {
      // Create new membership
      const { error: membershipError } = await supabase.from('user_club_memberships').insert({
        user_id: adminUser.id,
        club_id: club.id,
        role: 'superadmin',
        is_active: true,
      });

      if (membershipError) {
        console.error('❌ Membership error:', membershipError);
        process.exit(1);
      }
      console.log('✅ Membership created!');
    }

    // Verify
    const { data: verification } = await supabase
      .from('user_club_memberships')
      .select(
        `
        role,
        is_active,
        user_id,
        clubs (name)
      `
      )
      .eq('user_id', adminUser.id)
      .single();

    console.log('\n📊 Verification:');
    console.log('   User ID:', verification?.user_id);
    console.log('   Role:', verification?.role);
    console.log('   Active:', verification?.is_active);
    console.log('   Club:', verification?.clubs?.name);
    console.log('\n🎉 Setup complete! You can now login at:');
    console.log('   https://swingz.vercel.app/login');
    console.log('   Email: admin@swingz.com');
    console.log('   Password: AdminPass123!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

executeSql();

#!/usr/bin/env tsx
/**
 * Complete Production Admin Setup
 * Creates admin user in Supabase Auth and sets up profile + membership
 */

import { createServiceClient } from '@/lib/supabase/service';

const ADMIN_EMAIL = 'admin@swingz.com';
const ADMIN_PASSWORD = 'AdminPass123!';
const CLUB_SLUG = 'demo-club';
const CLUB_NAME = 'Demo Tennis Club';

async function setupCompleteAdmin() {
  console.log('🚀 Complete Admin Setup Starting...\n');

  const supabase = createServiceClient();

  try {
    // 1. Check if user exists in auth, if not create
    console.log('1️⃣  Checking/Creating user in Supabase Auth...');

    let userId: string;

    // Try to get existing user
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u) => u.email === ADMIN_EMAIL);

    if (existingUser) {
      userId = existingUser.id;
      console.log('✅ User already exists:', existingUser.email);
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: 'System Admin',
        },
      });

      if (createError) {
        console.error('❌ Error creating user:', createError.message);
        process.exit(1);
      }

      userId = newUser.user!.id;
      console.log('✅ User created:', ADMIN_EMAIL);
    }

    // 2. Create or update user profile
    console.log('\n2️⃣  Creating user profile...');

    // First check if profile exists
    const { data: existingProfile } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (existingProfile) {
      // Update existing profile
      const { error: updateError } = await supabase
        .from('users')
        .update({
          email: ADMIN_EMAIL,
          full_name: 'System Admin',
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) {
        console.error('❌ Error updating user profile:', updateError.message);
        process.exit(1);
      }
      console.log('✅ User profile updated');
    } else {
      // Create new profile
      const { error: userError } = await supabase.from('users').insert({
        id: userId,
        email: ADMIN_EMAIL,
        full_name: 'System Admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (userError) {
        console.error('❌ Error creating user profile:', userError.message);
        process.exit(1);
      }
      console.log('✅ User profile created');
    }

    // 3. Get or create demo club
    console.log('\n3️⃣  Setting up demo club...');
    let clubId: string;

    const { data: existingClub } = await supabase
      .from('clubs')
      .select('id')
      .eq('slug', CLUB_SLUG)
      .single();

    if (existingClub) {
      clubId = existingClub.id;
      console.log('✅ Demo club already exists:', clubId);
    } else {
      const { data: newClub, error: clubError } = await supabase
        .from('clubs')
        .insert({
          name: CLUB_NAME,
          slug: CLUB_SLUG,
          status: 'active',
          max_members: 500,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (clubError) {
        console.error('❌ Error creating club:', clubError.message);
        process.exit(1);
      }

      clubId = newClub!.id;
      console.log('✅ Demo club created:', clubId);
    }

    // 4. Create superadmin membership
    console.log('\n4️⃣  Creating superadmin membership...');
    const { error: membershipError } = await supabase.from('user_club_memberships').upsert(
      {
        user_id: userId,
        club_id: clubId,
        role: 'superadmin',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,club_id',
      }
    );

    if (membershipError) {
      console.error('❌ Error creating membership:', membershipError.message);
      process.exit(1);
    }

    console.log('✅ Superadmin membership created');

    // 5. Verify setup
    console.log('\n5️⃣  Verifying setup...');
    const { data: verification, error: verifyError } = await supabase
      .from('users')
      .select(
        `
        id,
        email,
        full_name,
        user_club_memberships (
          role,
          is_active,
          clubs (
            id,
            name,
            slug
          )
        )
      `
      )
      .eq('id', userId)
      .single();

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message);
      process.exit(1);
    }

    console.log('\n✅ Setup complete!\n');
    console.log('📊 Final configuration:');
    console.log('   User ID:', verification.id);
    console.log('   Email:', verification.email);
    console.log('   Name:', verification.full_name);
    console.log('   Role:', verification.user_club_memberships[0]?.role);
    console.log('   Club:', verification.user_club_memberships[0]?.clubs?.name);
    console.log('   Club ID:', verification.user_club_memberships[0]?.clubs?.id);
    console.log('\n🎉 You can now log in at https://swingz.vercel.app/login');
    console.log('   Email:', ADMIN_EMAIL);
    console.log('   Password:', ADMIN_PASSWORD);
  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run script
setupCompleteAdmin();

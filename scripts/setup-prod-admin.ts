#!/usr/bin/env tsx
/**
 * Production Admin Setup Script
 *
 * This script creates a superadmin user in production Supabase.
 *
 * Prerequisites:
 * - SUPABASE_URL environment variable
 * - SUPABASE_SERVICE_ROLE_KEY environment variable
 * - User already created in Supabase Auth Dashboard
 *
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx tsx scripts/setup-prod-admin.ts <user-uuid>
 */

import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'admin@swingz.com';
const CLUB_SLUG = 'demo-club';
const CLUB_NAME = 'Demo Tennis Club';

async function setupProdAdmin(userId: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing environment variables:');
    console.error('   SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
    process.exit(1);
  }

  if (!userId || userId.length !== 36) {
    console.error('❌ Invalid user UUID provided');
    console.error('   Usage: tsx scripts/setup-prod-admin.ts <user-uuid>');
    process.exit(1);
  }

  console.log('🚀 Setting up production admin user...\n');
  console.log('📧 Email:', ADMIN_EMAIL);
  console.log('🆔 User ID:', userId);
  console.log('🏢 Club:', CLUB_NAME);
  console.log('');

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // 1. Check if user exists in auth
    console.log('1️⃣  Checking user in Supabase Auth...');
    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId);

    if (authError) {
      console.error('❌ User not found in Supabase Auth');
      console.error('   Create user first in Supabase Dashboard → Authentication → Users');
      console.error('   Error:', authError.message);
      process.exit(1);
    }

    console.log('✅ User found in Auth:', authData.user.email);

    // 2. Create or update user profile
    console.log('\n2️⃣  Creating user profile...');
    const { error: userError } = await supabase.from('users').upsert(
      {
        id: userId,
        email: ADMIN_EMAIL,
        full_name: 'System Admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'id',
      }
    );

    if (userError) {
      console.error('❌ Error creating user profile:', userError.message);
      process.exit(1);
    }

    console.log('✅ User profile created');

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
        user_id: userData.id,
        club_id: club.id,
        role: 'admin', // Changed from 'superadmin' to 'admin' for club-scoped access
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
    console.log('   Password: (the password you set in Supabase Dashboard)');
  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run script
const userId = process.argv[2];
setupProdAdmin(userId);

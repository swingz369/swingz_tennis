/**
 * Create a fresh test admin + club for comprehensive E2E testing.
 * Creates: auth.users entry, public.users entry, club, admin membership.
 *
 * Usage: npx tsx scripts/create-test-admin.ts
 */
import 'dotenv/config';
import postgres from 'postgres';
import { randomBytes, randomUUID } from 'crypto';

const dbUrl = process.env.DATABASE_URL!;

async function main() {
  const sql = postgres(dbUrl);

  const userId = randomUUID();
  const clubId = randomUUID();
  const email = `e2e-admin-${Date.now()}@test.swingz.local`;
  const password = 'TestAdmin2026!';
  const clubName = `E2E Test Club ${new Date().toISOString().slice(0, 10)}`;

  console.log(`\n🔧 Creating test admin + club...\n`);
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Club: ${clubName}\n`);

  // 1. Create auth.users entry
  await sql.unsafe(
    `
    INSERT INTO auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      $1::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', $2::text,
      crypt($3::text, gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('full_name', $4::text),
      now(), now(), '', '', '', ''
    )
    ON CONFLICT (id) DO NOTHING
  `,
    [userId, email, password, 'E2E Test Admin']
  );

  // Create auth.identities
  await sql.unsafe(
    `
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      $1::uuid, $1::uuid,
      jsonb_build_object('sub', $1::uuid::text, 'email', $2::text),
      'email', $2::text,
      NULL, now(), now()
    )
    ON CONFLICT (id) DO NOTHING
  `,
    [userId, email]
  );

  console.log('  ✅ auth.users + auth.identities created');

  // 2. Create public.users entry
  await sql`
    INSERT INTO public.users (id, email, full_name, created_at, updated_at)
    VALUES (${userId}, ${email}, 'E2E Test Admin', now(), now())
    ON CONFLICT (id) DO NOTHING
  `;
  console.log('  ✅ public.users created');

  // 3. Create club
  await sql`
    INSERT INTO clubs (
      id, name, slug, timezone, opening_hours, 
      default_hourly_rate, status, created_at, updated_at
    ) VALUES (
      ${clubId}, ${clubName}, 'e2e-test-club', 'Europe/Berlin',
      '{"monday":{"open":"08:00","close":"22:00"},"tuesday":{"open":"08:00","close":"22:00"},"wednesday":{"open":"08:00","close":"22:00"},"thursday":{"open":"08:00","close":"22:00"},"friday":{"open":"08:00","close":"22:00"},"saturday":{"open":"09:00","close":"20:00"},"sunday":{"open":"09:00","close":"18:00"}}'::jsonb,
      '25.00', 'active', now(), now()
    )
    ON CONFLICT (id) DO NOTHING
  `;
  console.log('  ✅ Club created');

  // 4. Create admin membership
  await sql`
    INSERT INTO user_club_memberships (user_id, club_id, role, is_active, created_at)
    VALUES (${userId}, ${clubId}, 'admin', true, now())
    ON CONFLICT DO NOTHING
  `;
  console.log('  ✅ Admin membership created');

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`\n✅ Test admin ready!`);
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Club:     ${clubName}`);
  console.log(`   User ID:  ${userId}`);
  console.log(`   Club ID:  ${clubId}`);
  console.log(`\n🔗 Login at: http://localhost:3000/login\n`);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

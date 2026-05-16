/**
 * Admin Navigation Test - Tests all admin pages
 * Run with: npx tsx scripts/test-admin-pages.ts
 */

import { readFileSync } from 'fs';
import path from 'path';

interface AdminPage {
  name: string;
  route: string;
  filePath: string;
  exists: boolean;
  hasServerComponent: boolean;
  hasClientComponent: boolean;
  usesAuth: boolean;
  errors: string[];
}

async function testAdminPages() {
  console.log('\n🔍 TESTING ALL ADMIN PAGES\n');
  console.log('='.repeat(70));

  const adminRoutes = [
    { name: 'Analytics', route: '/admin/analytics' },
    { name: 'Onboarding', route: '/admin/onboarding' },
    { name: 'Clubs', route: '/admin/clubs' },
    { name: 'Mitglieder', route: '/admin/members' },
    { name: 'Trainer', route: '/admin/trainers' },
    { name: 'Schedules', route: '/admin/schedules' },
    { name: 'Platzverwaltung', route: '/admin/courts/manage' },
    { name: 'Genehmigungen', route: '/admin/approvals' },
    { name: 'Einstellungen', route: '/admin/settings' },
    { name: 'Billing Admin', route: '/admin/billing' },
  ];

  const results: AdminPage[] = [];

  for (const route of adminRoutes) {
    console.log(`\n📄 Testing: ${route.name} (${route.route})`);

    // Check if page.tsx exists
    const pagePath = `app/(protected)${route.route}/page.tsx`;
    const fullPath = path.join(process.cwd(), pagePath);

    let exists = false;
    let content = '';
    try {
      content = readFileSync(fullPath, 'utf-8');
      exists = true;
    } catch {
      try {
        // Try without (protected)
        const altPath = `app${route.route}/page.tsx`;
        content = readFileSync(path.join(process.cwd(), altPath), 'utf-8');
        exists = true;
      } catch {
        // Try with index
        try {
          const indexPath = `app/(protected)${route.route}/index.tsx`;
          content = readFileSync(path.join(process.cwd(), indexPath), 'utf-8');
          exists = true;
        } catch {
          exists = false;
        }
      }
    }

    const errors: string[] = [];

    if (!exists) {
      console.log('   ❌ Page does not exist!');
      errors.push('Page file not found');
    } else {
      console.log('   ✅ Page exists');

      // Check for 'use client' directive
      const hasClientDirective =
        content.includes("'use client'") || content.includes('"use client"');
      console.log(
        `   ${hasClientDirective ? '✅' : '⚠️ '} Client Component: ${hasClientDirective}`
      );

      // Check for async function (Server Component)
      const hasAsyncExport = /export\s+(default\s+)?async\s+function/.test(content);
      console.log(`   ${hasAsyncExport ? '✅' : '⚠️ '} Server Component: ${hasAsyncExport}`);

      // Check for auth usage
      const usesRequireAuth = content.includes('requireAuth');
      const usesWithApiAuth = content.includes('withApiAuth');
      const usesAuth = usesRequireAuth || usesWithApiAuth;
      console.log(`   ${usesAuth ? '✅' : '⚠️ '} Uses Auth: ${usesAuth}`);

      // Check for common errors
      if (content.includes('404')) {
        errors.push('Contains 404 reference');
        console.log('   ⚠️  Contains 404 reference');
      }

      if (content.includes('TODO') || content.includes('FIXME')) {
        errors.push('Contains TODO/FIXME');
        console.log('   ⚠️  Contains TODO/FIXME');
      }

      // Check for proper imports
      if (content.includes("from 'next/navigation'") && !hasClientDirective && !hasAsyncExport) {
        errors.push('Uses next/navigation without client directive');
        console.log("   ⚠️  Uses next/navigation without 'use client'");
      }

      // Check for Supabase usage
      if (content.includes('createClient') || content.includes('supabase')) {
        console.log('   ✅ Uses Supabase');
      }
    }

    results.push({
      name: route.name,
      route: route.route,
      filePath: pagePath,
      exists,
      hasServerComponent: exists && /export\s+(default\s+)?async\s+function/.test(content),
      hasClientComponent:
        exists && (content.includes("'use client'") || content.includes('"use client"')),
      usesAuth: exists && (content.includes('requireAuth') || content.includes('withApiAuth')),
      errors,
    });
  }

  // Summary
  console.log('\n\n📊 TEST SUMMARY');
  console.log('='.repeat(70));

  const existingPages = results.filter((r) => r.exists).length;
  const missingPages = results.filter((r) => !r.exists).length;
  const pagesWithErrors = results.filter((r) => r.errors.length > 0).length;

  console.log(`\n✅ Existing Pages: ${existingPages}/${results.length}`);
  console.log(`❌ Missing Pages: ${missingPages}/${results.length}`);
  console.log(`⚠️  Pages with Issues: ${pagesWithErrors}/${results.length}`);

  if (missingPages > 0) {
    console.log('\n\n❌ MISSING PAGES:');
    results
      .filter((r) => !r.exists)
      .forEach((page) => {
        console.log(`   • ${page.name} (${page.route})`);
      });
  }

  if (pagesWithErrors > 0) {
    console.log('\n\n⚠️  PAGES WITH ISSUES:');
    results
      .filter((r) => r.errors.length > 0)
      .forEach((page) => {
        console.log(`\n   ${page.name} (${page.route}):`);
        page.errors.forEach((err) => console.log(`      - ${err}`));
      });
  }

  console.log('\n');
}

testAdminPages().catch(console.error);

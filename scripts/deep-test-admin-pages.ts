/**
 * Deep Admin Page Tester
 * Tests each admin page for common issues
 */

import { readFileSync } from 'fs';
import path from 'path';

interface PageIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
}

interface PageTest {
  path: string;
  name: string;
  issues: PageIssue[];
}

function testPage(filePath: string, name: string): PageTest {
  const fullPath = path.join(process.cwd(), filePath);
  const issues: PageIssue[] = [];

  try {
    const content = readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    // Test 1: Check for requireAuth in Server Components
    const isServerComponent = /export\s+(default\s+)?async\s+function/.test(content);
    if (isServerComponent && !content.includes('requireAuth')) {
      issues.push({
        severity: 'warning',
        message: 'Server Component without requireAuth() - may allow unauthorized access',
      });
    }

    // Test 2: Check for proper error handling
    if (!content.includes('try') && !content.includes('catch')) {
      issues.push({
        severity: 'warning',
        message: 'No try-catch error handling found',
      });
    }

    // Test 3: Check for loading states
    if (
      content.includes("'use client'") &&
      !content.includes('loading') &&
      !content.includes('isLoading')
    ) {
      issues.push({
        severity: 'info',
        message: 'Client component without loading state',
      });
    }

    // Test 4: Check for hardcoded club IDs
    const hardcodedIds = content.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
    );
    if (hardcodedIds && hardcodedIds.length > 0) {
      issues.push({
        severity: 'warning',
        message: `Found ${hardcodedIds.length} hardcoded UUID(s) - may cause issues with multi-tenant`,
      });
    }

    // Test 5: Check for direct database access without RLS
    if (content.includes('.from(') && !content.includes(".eq('club_id'")) {
      issues.push({
        severity: 'warning',
        message: 'Database query without club_id filter - may bypass RLS',
      });
    }

    // Test 6: Check for missing null checks
    const hasNullCheck =
      content.includes('if (!') || content.includes('?.') || content.includes('??');
    if (!hasNullCheck && (content.includes('.map(') || content.includes('.filter('))) {
      issues.push({
        severity: 'warning',
        message: 'Array operations without null checks - may cause runtime errors',
      });
    }

    // Test 7: Check for console.log in production
    const consoleLines = lines
      .map((line, i) => ({ line, num: i + 1 }))
      .filter(({ line }) => line.includes('console.log') && !line.includes('console.error'));

    if (consoleLines.length > 0) {
      issues.push({
        severity: 'info',
        message: `Found ${consoleLines.length} console.log statement(s) - should be removed for production`,
        line: consoleLines[0].num,
      });
    }

    // Test 8: Check for TODO/FIXME
    const todoLines = lines
      .map((line, i) => ({ line, num: i + 1 }))
      .filter(({ line }) => line.includes('TODO') || line.includes('FIXME'));

    if (todoLines.length > 0) {
      issues.push({
        severity: 'warning',
        message: `Found ${todoLines.length} TODO/FIXME comment(s) - incomplete implementation`,
        line: todoLines[0].num,
      });
    }

    // Test 9: Check for proper TypeScript types
    if (content.includes(': any') || content.includes('as any')) {
      issues.push({
        severity: 'info',
        message: 'Uses "any" type - consider using proper TypeScript types',
      });
    }

    // Test 10: Check for 404/empty state handling
    if (!content.includes('No ') && !content.includes('Keine ') && !content.includes('empty')) {
      issues.push({
        severity: 'info',
        message: 'Missing empty state handling - consider adding "No results" message',
      });
    }
  } catch (error) {
    issues.push({
      severity: 'error',
      message: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  return { path: filePath, name, issues };
}

async function runTests() {
  console.log('\n🧪 DEEP ADMIN PAGE ANALYSIS\n');
  console.log('='.repeat(70));

  const pages = [
    { path: 'app/(protected)/admin/analytics/page.tsx', name: 'Analytics' },
    { path: 'app/(protected)/admin/onboarding/page.tsx', name: 'Onboarding' },
    { path: 'app/(protected)/admin/clubs/page.tsx', name: 'Clubs' },
    { path: 'app/(protected)/admin/members/page.tsx', name: 'Mitglieder' },
    { path: 'app/(protected)/admin/trainers/page.tsx', name: 'Trainer' },
    { path: 'app/(protected)/admin/schedules/page.tsx', name: 'Schedules' },
    { path: 'app/(protected)/admin/courts/manage/page.tsx', name: 'Platzverwaltung' },
    { path: 'app/(protected)/admin/approvals/page.tsx', name: 'Genehmigungen' },
    { path: 'app/(protected)/admin/settings/page.tsx', name: 'Einstellungen' },
    { path: 'app/(protected)/admin/billing/page.tsx', name: 'Billing Admin' },
  ];

  const results: PageTest[] = [];

  for (const page of pages) {
    console.log(`\n📄 ${page.name}`);
    const result = testPage(page.path, page.name);
    results.push(result);

    if (result.issues.length === 0) {
      console.log('   ✅ No issues found');
    } else {
      const errors = result.issues.filter((i) => i.severity === 'error');
      const warnings = result.issues.filter((i) => i.severity === 'warning');
      const infos = result.issues.filter((i) => i.severity === 'info');

      if (errors.length > 0) {
        console.log(`   ❌ ${errors.length} Error(s)`);
        errors.forEach((e) => console.log(`      ${e.message}`));
      }
      if (warnings.length > 0) {
        console.log(`   ⚠️  ${warnings.length} Warning(s)`);
        warnings.forEach((w) => console.log(`      ${w.message}`));
      }
      if (infos.length > 0) {
        console.log(`   ℹ️  ${infos.length} Info(s)`);
        infos.forEach((i) => console.log(`      ${i.message}`));
      }
    }
  }

  // Summary
  console.log('\n\n📊 SUMMARY');
  console.log('='.repeat(70));

  const totalErrors = results.reduce(
    (sum, r) => sum + r.issues.filter((i) => i.severity === 'error').length,
    0
  );
  const totalWarnings = results.reduce(
    (sum, r) => sum + r.issues.filter((i) => i.severity === 'warning').length,
    0
  );
  const totalInfos = results.reduce(
    (sum, r) => sum + r.issues.filter((i) => i.severity === 'info').length,
    0
  );

  console.log(`\n❌ Total Errors: ${totalErrors}`);
  console.log(`⚠️  Total Warnings: ${totalWarnings}`);
  console.log(`ℹ️  Total Infos: ${totalInfos}`);

  const pagesWithIssues = results.filter((r) => r.issues.length > 0);
  console.log(`\n${pagesWithIssues.length}/${results.length} pages have issues`);

  if (totalErrors > 0 || totalWarnings > 0) {
    console.log('\n🔧 RECOMMENDED FIXES:');
    console.log('   1. Add requireAuth() to all Server Components');
    console.log('   2. Add proper error handling (try-catch)');
    console.log('   3. Remove hardcoded UUIDs');
    console.log('   4. Add club_id filters to all queries');
    console.log('   5. Remove TODO/FIXME and console.log statements');
  }

  console.log('\n');
}

runTests().catch(console.error);

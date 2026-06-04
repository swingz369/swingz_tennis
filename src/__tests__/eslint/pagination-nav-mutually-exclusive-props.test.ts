// @vitest-environment node

/**
 * Unit tests for the custom ESLint rule: pagination-nav-mutually-exclusive-props
 *
 * Uses ESLint's RuleTester to verify the rule correctly detects
 * <PaginationNav> with both `buildUrl` and `onPageChange` props.
 */
import { RuleTester } from 'eslint';
import rule from '../../../eslint-rules/pagination-nav-mutually-exclusive-props.js';

const tester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
});

tester.run('pagination-nav-mutually-exclusive-props', rule, {
  // ── Valid cases (should not report) ──────────────────────
  valid: [
    {
      name: 'only buildUrl',
      code: '<PaginationNav meta={m} buildUrl={(p) => `?page=${p}`} />',
    },
    {
      name: 'only onPageChange',
      code: '<PaginationNav meta={m} onPageChange={setPage} />',
    },
    {
      name: 'neither prop (meta only)',
      code: '<PaginationNav meta={m} />',
    },
    {
      name: 'different component with both props (not PaginationNav)',
      code: '<OtherComponent buildUrl={fn} onPageChange={fn} />',
    },
    {
      name: 'namespaced PaginationNav with only buildUrl',
      code: '<UI.PaginationNav meta={m} buildUrl={fn} />',
    },
    {
      name: 'namespaced PaginationNav with only onPageChange',
      code: '<UI.PaginationNav meta={m} onPageChange={fn} />',
    },
  ],

  // ── Invalid cases (should report) ────────────────────────
  invalid: [
    {
      name: 'both buildUrl and onPageChange',
      code: '<PaginationNav meta={m} buildUrl={(p) => `?page=${p}`} onPageChange={setPage} />',
      errors: [{ messageId: 'bothProps' }],
    },
    {
      name: 'both props — reversed order',
      code: '<PaginationNav meta={m} onPageChange={setPage} buildUrl={fn} />',
      errors: [{ messageId: 'bothProps' }],
    },
    {
      name: 'namespaced PaginationNav with both props',
      code: '<UI.PaginationNav meta={m} buildUrl={fn} onPageChange={fn} />',
      errors: [{ messageId: 'bothProps' }],
    },
  ],
});

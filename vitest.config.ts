import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react({ tsDecorators: true })],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    globalSetup: './src/__tests__/global-setup.ts',
    include: [
      // Single canonical unit-test tree (consolidated 2026-08-13: former
      // `tests/unit/**` was folded into `src/__tests__`).
      'src/**/__tests__/**/*.test.{ts,tsx}',
      // e2e/**/*.test.ts need a live `npm run dev` server (see each file's header) —
      // only included when explicitly opted into via `npm run test:e2e-browser`,
      // so a plain `vitest run` doesn't falsely report them as broken.
      ...(process.env.RUN_BROWSER_E2E === 'true' ? ['e2e/**/*.test.ts'] : []),
    ],
    exclude: [
      'node_modules/**',
      '.next/**',
      // `.claude/` and its worktree subdirectories contain parallel-agent
      // working copies of the same test files. Without these patterns,
      // `npx vitest bench <file>` still discovers and runs the worktree
      // copies, producing NaN measurements and polluting `.bench-results.json`.
      '.claude/**',
      '**/.claude/**',
      '**/worktrees/**',
      '**/agent-*/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'src/**/*.{ts,tsx}',
        'app/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'lib/**/*.{ts,tsx}',
      ],
      exclude: [
        'node_modules/**',
        '.next/**',
        'coverage/**',
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/__tests__/**',
        '**/types/**',
        'app/api/**/route.ts',
      ],
      // Coverage thresholds (Ziel: schrittweise erhöhen)
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 55,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      'server-only': path.resolve(__dirname, './src/__tests__/mocks/server-only.ts'),
      '@/domain': path.resolve(__dirname, './src/domain'),
      '@/application': path.resolve(__dirname, './src/application'),
      '@/infrastructure': path.resolve(__dirname, './src/infrastructure'),
      '@/presentation': path.resolve(__dirname, './src/presentation'),
      '@': path.resolve(__dirname, './'),
    },
  },
});

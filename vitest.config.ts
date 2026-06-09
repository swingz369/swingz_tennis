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
    include: ['src/**/__tests__/**/*', 'tests/unit/**/*', 'e2e/**/*.test.ts'],
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
      '@/domain': path.resolve(__dirname, './src/domain'),
      '@/application': path.resolve(__dirname, './src/application'),
      '@/infrastructure': path.resolve(__dirname, './src/infrastructure'),
      '@/presentation': path.resolve(__dirname, './src/presentation'),
      '@': path.resolve(__dirname, './'),
    },
  },
});

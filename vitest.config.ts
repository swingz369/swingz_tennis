import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react({ tsDecorators: true })],
  test: {
    environment: 'jsdom',
    globals: true,
    include: [
      'src/**/__tests__/**/*.test.ts',
      'src/**/__tests__/**/*.test.tsx',
      'tests/unit/**/*.test.ts',
      'tests/unit/**/*.test.tsx',
      'e2e/**/*.test.ts',
    ],
    setupFiles: ['./src/__tests__/setup.ts'],
    globalSetup: ['./src/__tests__/global-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/__tests__/', '**/*.config.{ts,js}', '**/types/**'],
    },
  },
  resolve: {
    alias: {
      '@/domain': path.resolve(__dirname, './src/domain'),
      '@/application': path.resolve(__dirname, './src/application'),
      '@/infrastructure': path.resolve(__dirname, './src/infrastructure'),
      '@/src': path.resolve(__dirname, './src'),
      '@/presentation': path.resolve(__dirname, './src/presentation'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/app': path.resolve(__dirname, './app'),
      '@/components': path.resolve(__dirname, './components'),
      '@/hooks': path.resolve(__dirname, './hooks'),
      '@/i18n': path.resolve(__dirname, './i18n'),
    },
  },
});

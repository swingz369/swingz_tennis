// Use the project's installed @playwright/test (1.60.0)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/qa-audit-full.spec.ts',
  fullyParallel: false,
  forbidOnly: false,
  retries: 0,
  timeout: 45000,
  reporter: [['list'], ['json', { outputFile: 'test-results/qa-audit-results.json' }]],
  use: {
    baseURL: 'https://swingz.vercel.app',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'off',
    actionTimeout: 20000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  // No webServer — testing live Vercel deployment
});

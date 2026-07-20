import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local with explicit path resolution and override to ensure vars are always injected
config({ path: resolve(__dirname, '.env.local'), override: true });

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  reporter: 'list',
  // Dev-Server kompiliert Routen on-demand — Erstbesuch einer Route kann >20s dauern
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    navigationTimeout: 45000,
    actionTimeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'ipad',
      use: { ...devices['iPad (gen 7)'] },
    },
  ],
  webServer: {
    command: 'DISABLE_RATE_LIMITING=true npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    // Kaltstart ohne .next-Cache braucht deutlich länger als 30s
    timeout: 120000,
  },
});

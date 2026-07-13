import { defineConfig, devices } from '@playwright/test';

const projects = process.env.CI
  ? [{
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  }]
  : [{
    name: 'chrome',
    use: {
      ...devices['Desktop Chrome'],
      channel: 'chrome',
    },
  }];

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects,
  webServer: {
    command: 'npm run build && node scripts/serve-site.mjs',
    reuseExistingServer: false,
    timeout: 30_000,
    url: 'http://127.0.0.1:4173',
  },
});

import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1, timeout: 90000,
  use: {
    baseURL: 'http://127.0.0.1:5187', viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce', launchOptions: { args: ['--enable-unsafe-swiftshader'] },
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
  },
  webServer: { command: 'node server/browser-test-server.mjs', url: 'http://127.0.0.1:5187/api/health', reuseExistingServer: false, timeout: 120000 },
});
import { defineConfig } from '@playwright/test';

// Runs the built app on the real server, with an in-memory database that each test resets.
// Uses the installed Google Chrome, so no browser download is needed.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  // the tests share one server and its database
  workers: 1,
  use: {
    baseURL: 'http://localhost:5174',
    channel: 'chrome',
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: 'npx vite build --logLevel warn && node server/main.ts',
    url: 'http://localhost:5174/api/health',
    reuseExistingServer: false,
    env: {
      PORT: '5174',
      HOST: '127.0.0.1',
      DB_PATH: ':memory:',
      STATIC_DIR: 'dist',
      TEST_RESET: '1',
    },
  },
});

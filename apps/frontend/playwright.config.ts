import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration.
 *
 * Tests live in e2e/ at the repository root.
 * Run: cd apps/frontend && npm run test:e2e
 *
 * Requires the app to be running:
 *   docker compose -f infra/docker/docker-compose.yml --project-directory . up -d
 * or locally:
 *   cd apps/frontend && npm run dev  (port 39101)
 *   cd apps/api && python manage.py runserver 0.0.0.0:39100
 *
 * Environment variables:
 *   BASE_URL        — frontend origin  (default: http://localhost:39101)
 *   E2E_USERNAME    — test user login  (default: admin)
 *   E2E_PASSWORD    — test user password (default: admin)
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:39101';

export default defineConfig({
  testDir: '../../e2e',

  // Consolidate all Playwright output (HTML/JUnit reports + failure traces
  // and screenshots) under a single gitignored directory instead of two.
  outputDir: '../../e2e-results/test-results',

  // Run each test file in parallel; keep tests within a file sequential so
  // login state is preserved across steps.
  fullyParallel: false,
  workers: 1,

  // Retry once on CI to tolerate transient network hiccups.
  retries: process.env.CI ? 1 : 0,

  reporter: process.env.CI
    ? [['junit', { outputFile: '../../e2e-results/results.xml' }], ['list']]
    : [['html', { outputFolder: '../../e2e-results/html', open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    // Persist cookies/localStorage so auth survives across page navigations.
    storageState: undefined,
    // Record traces on first retry to aid debugging CI failures.
    trace: 'on-first-retry',
    // Capture screenshot on failure.
    screenshot: 'only-on-failure',
    // Default navigation timeout.
    navigationTimeout: 30_000,
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

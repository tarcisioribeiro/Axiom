import { type Page } from '@playwright/test';

if (!process.env.E2E_USERNAME || !process.env.E2E_PASSWORD) {
  throw new Error(
    'E2E_USERNAME and E2E_PASSWORD must be set as CI/CD variables. ' +
      'Run seed:staging in GitLab to create the test account.'
  );
}

export const E2E_USERNAME = process.env.E2E_USERNAME as string;
export const E2E_PASSWORD = process.env.E2E_PASSWORD as string;

/**
 * Log in via the login form and wait for the home page to load.
 * Reuses the same browser context so cookies persist for subsequent
 * requests made by the page.
 */
export async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/usuário/i).fill(E2E_USERNAME);
  await page.getByLabel(/senha/i).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: /entrar/i }).click();
  // Wait until redirected away from /login
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 15_000,
  });
}

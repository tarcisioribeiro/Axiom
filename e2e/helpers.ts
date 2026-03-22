import { type Page } from '@playwright/test';

// Use || instead of ?? so that empty-string CI variables fall back to the
// default values (the token endpoint rejects empty credentials, and HTML5
// required validation silently blocks the form without navigating away).
export const E2E_USERNAME = process.env.E2E_USERNAME || 'e2e_tester';
export const E2E_PASSWORD = process.env.E2E_PASSWORD || 'E2eTest@2025';

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

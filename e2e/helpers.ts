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

/**
 * Ensure the e2e user has at least one bank account. The expenses form
 * requires an account to exist before it allows creating a new expense.
 * If no accounts exist, one is created via the API using the session
 * cookies already set by a prior `login()` call.
 */
export async function ensureAccount(page: Page): Promise<void> {
  const baseUrl = process.env.BASE_URL ?? 'http://localhost:39101';
  const apiBase = baseUrl.replace(':39101', ':39100');

  const listResp = await page.request.get(`${apiBase}/api/v1/accounts/`);
  if (!listResp.ok()) return; // can't verify — proceed and let the test fail naturally

  const body = await listResp.json();
  if ((body.count ?? body.results?.length ?? 0) > 0) return; // already exists

  await page.request.post(`${apiBase}/api/v1/accounts/`, {
    data: {
      account_name: 'Conta E2E',
      institution: 'NUB',
      account_type: 'CC',
    },
  });
}

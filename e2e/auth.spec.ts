import { test, expect } from '@playwright/test';

import { E2E_USERNAME, E2E_PASSWORD, login } from './helpers';

test.describe('Authentication', () => {
  test('login page renders the Axiom logo and form', async ({ page }) => {
    await page.goto('/login');

    // Logo image is present
    await expect(page.getByRole('img', { name: /axiom/i })).toBeVisible();

    // Username and password inputs exist
    await expect(page.getByLabel(/usuário/i)).toBeVisible();
    await expect(page.getByLabel(/senha/i)).toBeVisible();

    // Submit button is present
    await expect(page.getByRole('button', { name: /entrar/i })).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/usuário/i).fill('nonexistent_user');
    await page.getByLabel(/senha/i).fill('wrong_password');
    await page.getByRole('button', { name: /entrar/i }).click();

    // An error message should appear (the store sets error state)
    await expect(
      page.locator('[class*="destructive"]').first()
    ).toBeVisible({ timeout: 10_000 });

    // URL must remain at /login
    expect(page.url()).toContain('/login');
  });

  test('successful login redirects to the home page', async ({ page }) => {
    await login(page);

    // After login the URL must no longer be /login
    expect(page.url()).not.toContain('/login');

    // The sidebar / layout should be visible — look for a recognizable nav element
    await expect(page.locator('nav, aside, [role="navigation"]').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('authenticated user is redirected away from /login', async ({ page }) => {
    // Log in first, then try to navigate back to /login
    await login(page);
    await page.goto('/login');

    // Should be redirected away immediately
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
      timeout: 10_000,
    });
    expect(page.url()).not.toContain('/login');
  });

  test('logout clears session and redirects to /login', async ({ page }) => {
    await login(page);

    // Open user menu and click logout — try common patterns
    const logoutTrigger =
      page.getByRole('button', { name: /sair|logout/i }).first();

    if (await logoutTrigger.isVisible()) {
      await logoutTrigger.click();
    } else {
      // May be behind an avatar/user-menu dropdown
      await page.locator('[data-testid="user-menu"], [aria-label*="usuário"]').first().click();
      await page.getByRole('menuitem', { name: /sair|logout/i }).click();
    }

    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain('/login');

    // Re-visit a protected route — should be redirected to login
    await page.goto('/');
    await page.waitForURL(/\/login/, { timeout: 10_000 });
  });

  test('register page is accessible from the login page', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('link', { name: /cadastre|registr/i }).click();
    await expect(page).toHaveURL(/\/register/);
  });
});

// Keep credentials out of test output
test.describe('Credential isolation', () => {
  test('each test starts with a clean browser context', async ({ page }) => {
    // Simply verify the login page is shown before any login action
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /entrar/i })).toBeEnabled();
  });
});

// Export helper so other spec files can reuse it
export { E2E_USERNAME, E2E_PASSWORD };

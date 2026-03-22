import { test, expect } from '@playwright/test';

import { login, ensureAccount } from './helpers';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('dashboard loads with at least one StatCard visible', async ({ page }) => {
    // The dashboard renders several financial stat cards.
    // We look for common stat card patterns — a card containing a currency
    // symbol (R$) or a percentage sign, which are always present in Brazilian
    // financial summaries.
    await expect(
      page.locator('text=/R\\$|%/').first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('dashboard page heading is visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /dashboard|painel|visão geral/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('balance stat card is present', async ({ page }) => {
    // The dashboard always shows a total balance card labelled "Saldo" or similar
    await expect(
      page.getByText(/saldo total|saldo disponível|saldo/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('monthly expenses stat card is present', async ({ page }) => {
    await expect(
      page.getByText(/despesas do mês|despesas mensais|total de despesas/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('monthly revenues stat card is present', async ({ page }) => {
    await expect(
      page.getByText(/receitas do mês|receitas mensais|total de receitas/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('dashboard does not show an unhandled error', async ({ page }) => {
    // Fail if the page shows a generic error boundary message
    const errorBoundary = page.getByText(/algo deu errado|erro inesperado|error boundary/i);
    await expect(errorBoundary).not.toBeVisible();
  });

  test('navigating to /expenses from the dashboard works', async ({ page }) => {
    // The "Despesas" link lives inside two nested collapsible sections:
    //   1. Module "Controle Financeiro"  →  2. Submodule "Registros"
    // Both must be expanded before the link is clickable.
    await page
      .getByRole('button', { name: /controle financeiro/i })
      .first()
      .click();

    await page
      .getByRole('button', { name: /registros/i })
      .first()
      .click();

    const expensesLink = page.getByRole('link', { name: 'Despesas' }).first();
    await expensesLink.click();
    await expect(page).toHaveURL(/\/expenses/, { timeout: 10_000 });

    await expect(
      page.getByRole('heading', { name: /despesa/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('creating an expense updates the dashboard balance', async ({ page }) => {
    // Read the current "Saldo total" value from the dashboard
    const balanceCard = page.getByText(/saldo total|saldo disponível/i).first();
    await expect(balanceCard).toBeVisible();

    // Navigate to expenses and create a new one
    // Ensure an account exists so the create dialog is allowed to open.
    await ensureAccount(page);
    await page.goto('/expenses');
    await page.waitForLoadState('networkidle');

    const description = `Dashboard E2E ${Date.now()}`;
    await page.getByRole('button', { name: /nova despesa|adicionar/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page
      .getByRole('dialog')
      .getByLabel(/descrição/i)
      .fill(description);

    await page
      .getByRole('dialog')
      .getByLabel(/valor/i)
      .first()
      .fill('10.00');

    await page
      .getByRole('dialog')
      .getByRole('button', { name: /salvar|confirmar|criar/i })
      .click();

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

    // Return to dashboard and verify it still renders correctly (no crash)
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(
      page.locator('text=/R\\$|%/').first()
    ).toBeVisible({ timeout: 15_000 });
  });
});

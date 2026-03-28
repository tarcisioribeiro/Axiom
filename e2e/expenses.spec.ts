import { test, expect } from '@playwright/test';

import { login, ensureAccount } from './helpers';

test.describe('Expenses', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // The create-expense form guards against missing accounts; ensure one exists.
    await ensureAccount(page);
    await page.goto('/expenses');
    // Wait for the page to finish loading data
    await page.waitForLoadState('networkidle');
  });

  test('expenses page renders the data table and action buttons', async ({ page }) => {
    // Page header should be visible
    await expect(
      page.getByRole('heading', { name: /despesa/i }).first()
    ).toBeVisible({ timeout: 10_000 });

    // "Nova despesa" / add button must exist
    await expect(
      page.getByRole('button', { name: /nova despesa|adicionar/i }).first()
    ).toBeVisible();
  });

  test('create expense form opens when clicking the add button', async ({ page }) => {
    await page.getByRole('button', { name: /nova despesa|adicionar/i }).first().click();

    // A dialog / modal should appear
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  });

  test('create expense — fills form and submits successfully', async ({ page }) => {
    const description = `Despesa E2E ${Date.now()}`;

    // Open the create dialog
    await page.getByRole('button', { name: /nova despesa|adicionar/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    // Fill in description
    await page
      .getByRole('dialog')
      .getByLabel(/descrição/i)
      .fill(description);

    // Fill in amount (value)
    const amountInput = page.getByRole('dialog').getByLabel(/valor/i).first();
    await amountInput.fill('50.00');

    // Date is pre-filled with today by default — no need to set it.
    // (getByLabel(/data/i) would match the aria-label "Limpar data" clear button,
    //  not the flatpickr input, so we skip the fill to avoid that selector trap.)

    // Category is a Radix UI Select (not a native <select>) — use click, not selectOption()
    await page.getByRole('dialog').getByRole('combobox').first().click();
    await page.getByRole('listbox').getByRole('option').first().click();
    // Wait for the category listbox to close before interacting with next select
    await expect(page.getByRole('listbox')).not.toBeVisible({ timeout: 5_000 });

    // Account is the 3rd combobox (index 2) — select explicitly; the useEffect
    // auto-selection may not update the controlled Select value in time
    await page.getByRole('dialog').getByRole('combobox').nth(2).click();
    await page.getByRole('listbox').getByRole('option').first().click();

    // Submit
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /salvar|confirmar|criar/i })
      .click();

    // Dialog should close after a successful save
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

    // The new description should appear in the data table
    await expect(page.getByRole('table').getByText(description)).toBeVisible({ timeout: 10_000 });
  });

  test('newly created expense appears in the expenses list', async ({ page }) => {
    const description = `Listagem E2E ${Date.now()}`;

    await page.getByRole('button', { name: /nova despesa|adicionar/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page
      .getByRole('dialog')
      .getByLabel(/descrição/i)
      .fill(description);

    const amountInput = page.getByRole('dialog').getByLabel(/valor/i).first();
    await amountInput.fill('25.00');

    // Category is required (Zod enum) — select the first option via Radix UI click
    await page.getByRole('dialog').getByRole('combobox').first().click();
    await page.getByRole('listbox').getByRole('option').first().click();
    await expect(page.getByRole('listbox')).not.toBeVisible({ timeout: 5_000 });

    // Account is the 3rd combobox (index 2) — select explicitly
    await page.getByRole('dialog').getByRole('combobox').nth(2).click();
    await page.getByRole('listbox').getByRole('option').first().click();

    await page
      .getByRole('dialog')
      .getByRole('button', { name: /salvar|confirmar|criar/i })
      .click();

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

    // Verify the expense is listed in the table
    await expect(page.getByRole('table').getByText(description)).toBeVisible({ timeout: 10_000 });
  });

  test('search filter narrows the expenses list', async ({ page }) => {
    // Type a highly unlikely term so the list returns empty (empty state)
    const searchInput = page.getByPlaceholder(/buscar|pesquisar|search/i).first();
    await searchInput.fill('xyzzy_nonexistent_expense_12345');

    // The search input is debounced (300 ms). Wait for the debounce to fire
    // and the filtered request to complete before checking the result.
    await page.waitForTimeout(600);
    await page.waitForLoadState('networkidle');

    // Either an empty state message or zero rows
    const emptyState = page.getByText(/nenhuma despesa|sem resultado|vazio/i).first();
    const rows = page.getByRole('row');
    const rowCount = await rows.count();

    // Header row + 0 data rows = 1, or an explicit empty state text
    const isEmpty = (await emptyState.isVisible()) || rowCount <= 1;
    expect(isEmpty).toBe(true);
  });
});

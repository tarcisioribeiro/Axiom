import { expect, test } from '@playwright/test';

import { login } from './helpers';

test.describe('Conciliação Bancária', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/bank-reconciliation');
    await page.waitForLoadState('networkidle');
  });

  test('página de conciliação bancária renderiza', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /concilia/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('botão de importar extrato está visível', async ({ page }) => {
    const importBtn = page.getByRole('button', { name: /importar|novo|upload/i }).first();
    await expect(importBtn).toBeVisible({ timeout: 8_000 });
  });

  test('estado vazio ou lista de extratos é exibido', async ({ page }) => {
    const isEmpty = await page.getByText(/nenhum extrato|sem extratos|importe/i).isVisible().catch(() => false);
    const hasTable = await page.getByRole('table').isVisible().catch(() => false);
    const hasCard = await page.locator('[class*="card"]').first().isVisible().catch(() => false);
    expect(isEmpty || hasTable || hasCard).toBeTruthy();
  });

  test('diálogo de importação abre ao clicar no botão', async ({ page }) => {
    const importBtn = page.getByRole('button', { name: /importar|novo|upload/i }).first();
    await importBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  });

  test('diálogo de importação tem input de arquivo', async ({ page }) => {
    const importBtn = page.getByRole('button', { name: /importar|novo|upload/i }).first();
    await importBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    const dialog = page.getByRole('dialog');
    // Should have file input for OFX/CSV/CNAB
    const fileInput = dialog.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
  });

  test('formatos suportados são mencionados (OFX, CSV, CNAB)', async ({ page }) => {
    const importBtn = page.getByRole('button', { name: /importar|novo|upload/i }).first();
    await importBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    const dialog = page.getByRole('dialog');
    const content = await dialog.textContent();
    const hasFormat =
      /ofx|csv|cnab/i.test(content ?? '');
    expect(hasFormat).toBeTruthy();
  });

  test('página carrega sem erros críticos de console', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/bank-reconciliation');
    await page.waitForLoadState('networkidle');
    const critical = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('ResizeObserver')
    );
    expect(critical).toHaveLength(0);
  });
});

test.describe('Importação de Extrato Bancário', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('página /bank-statement-import renderiza', async ({ page }) => {
    await page.goto('/bank-statement-import');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL('/login');
    // Should render some content (either form or redirect)
    const hasContent = await page.locator('body').textContent();
    expect(hasContent?.length).toBeGreaterThan(0);
  });
});

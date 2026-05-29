import { expect, test } from '@playwright/test';

import { login } from './helpers';

test.describe('Vault (Cofres)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/vaults');
    await page.waitForLoadState('networkidle');
  });

  test('página de cofres renderiza corretamente', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /cofre/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('botão de criar cofre está visível', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /novo cofre|criar|adicionar/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('estado vazio exibe mensagem adequada quando não há cofres', async ({ page }) => {
    const hasEmptyState = await page.getByText(/nenhum cofre|sem cofres/i).isVisible();
    const hasTable = await page.getByRole('table').isVisible().catch(() => false);
    const hasCards = await page.locator('[data-testid="vault-card"], .vault-card').isVisible().catch(() => false);
    // Either empty state or content must be visible
    expect(hasEmptyState || hasTable || hasCards).toBeTruthy();
  });

  test('diálogo de criar cofre abre ao clicar no botão', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: /novo cofre|criar|adicionar/i }).first();
    await createBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    // Dialog should have a title
    await expect(
      page.getByRole('dialog').getByRole('heading').first()
    ).toBeVisible();
  });

  test('formulário de cofre tem campos obrigatórios', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: /novo cofre|criar|adicionar/i }).first();
    await createBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

    const dialog = page.getByRole('dialog');
    // Should have description/name field
    const nameField = dialog.getByLabel(/descrição|nome/i).first();
    await expect(nameField).toBeVisible();
  });

  test('página de cofres carrega sem erros de console críticos', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/vaults');
    await page.waitForLoadState('networkidle');
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('ResizeObserver')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('Vault Security (Cofre de Senhas)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/security');
    await page.waitForLoadState('networkidle');
  });

  test('página de segurança renderiza corretamente', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /senha|segurança|cofre/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('status do cofre (travado/desbloqueado) é exibido', async ({ page }) => {
    // Either locked or unlocked state should be indicated
    const lockedText = page.getByText(/travado|bloqueado|locked/i).first();
    const unlockedText = page.getByText(/desbloqueado|aberto|unlocked/i).first();
    const hasStatus =
      (await lockedText.isVisible().catch(() => false)) ||
      (await unlockedText.isVisible().catch(() => false));

    // There should be some vault status indicator
    const unlockBtn = page.getByRole('button', { name: /desbloquear|unlock/i }).first();
    const hasBtn = await unlockBtn.isVisible().catch(() => false);

    expect(hasStatus || hasBtn).toBeTruthy();
  });

  test('botão de exportar senhas existe', async ({ page }) => {
    const exportBtn = page.getByRole('button', { name: /export|exportar/i }).first();
    await expect(exportBtn).toBeVisible({ timeout: 8_000 });
  });
});

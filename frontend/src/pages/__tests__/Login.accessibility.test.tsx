/**
 * Login page — accessibility tests (axe).
 *
 * Covers: form elements, error state.
 */

// ---- Auth store mock (configurable per-test) ----
const { mockAuthStore } = vi.hoisted(() => ({
  mockAuthStore: {
    login: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
    error: null as string | null,
  },
}));

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => mockAuthStore,
}));

vi.mock('@/hooks/use-theme-assets', () => ({
  useThemeAssets: () => ({ logo: '/logo.svg' }),
}));

// ---- Imports ----
import { render } from '@testing-library/react';
import i18next from 'i18next';
import { configureAxe, toHaveNoViolations } from 'jest-axe';
import { initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import ptBR from '@/i18n/locales/pt-BR.json';
import Login from '@/pages/Login';

expect.extend(toHaveNoViolations);
const axe = configureAxe();

beforeAll(async () => {
  if (!i18next.isInitialized) {
    await i18next.use(initReactI18next).init({
      lng: 'pt-BR',
      fallbackLng: 'pt-BR',
      resources: { 'pt-BR': { translation: ptBR } },
      interpolation: { escapeValue: false },
    });
  }
});

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

describe('Login page accessibility', () => {
  beforeEach(() => {
    mockAuthStore.isLoading = false;
    mockAuthStore.error = null;
  });

  it('form elements — no axe violations', async () => {
    const { container } = renderLogin();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('error state — no axe violations', async () => {
    mockAuthStore.error = 'Credenciais inválidas';
    const { container } = renderLogin();
    expect(await axe(container)).toHaveNoViolations();
  });
});
